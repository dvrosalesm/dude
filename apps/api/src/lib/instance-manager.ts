/**
 * Agent Instance Manager
 *
 * One background runner (pi / codex / hermes) per agent instance:
 * - Dude (main-assistant): one process per org + user thread
 * - Subagent: one process per org + subagent kind + workspace
 *
 * Instance id: `{agentKind}:{scopeId}` (see @dude/sdk/runner)
 */

import { ChildProcess, spawn } from 'child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { mkdir, rm } from 'fs/promises';
import type {
  AgentInstance,
  AgentConfig,
} from './types';
import { DEFAULT_AGENT_RUNNER_ID } from './types';
import { resolveServerRunner } from './runners/index.js';
import {
  buildRuntimeSecrets,
  credentialsFingerprint,
  type RuntimeSecrets,
} from './runtime-config.js';
import {
  clearWorkspaceRuntimeSecrets,
  registerInstanceRuntimeSecretsProvider,
  registerSpawnFileRuntimeSecretsProvider,
  setWorkspaceRuntimeSecrets,
} from './runtime-secrets-store.js';
import { rehydrateRuntimeSecretsFromSpawnFile } from './runtime-secrets-rehydrate.js';
import {
  captureTmuxPane,
  isTmuxSessionAlive,
  killTmuxSession,
  shouldSpawnAgentInTmux,
  spawnAgentInTmux,
  tmuxAttachCommand,
  buildTmuxSessionName,
} from './agent-tmux-spawn.js';
import { killStaleWorkspaceAgent } from './agent-gateway-marker.js';
import { killProcessOnPort } from './agent-port-utils.js';
import {
  buildRunnerSessionManifest,
  resolveMainApiPort,
  RUNNER_SESSION_MANIFEST_FILENAME,
  writeRunnerSessionManifest,
} from './runner-session-manifest.js';
import { getLocalDbPath } from './local-sqlite.js';
import {
  ensureWorkspaceForToolHost,
} from './workspace-tool-host-sync.js';
import { resolveToolHostWorkspaceId } from './tool-host/resolve-subagent-id.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const HEALTH_TIMEOUT_MS = 60_000; // 1 minute (no Docker build, just process startup)
const PORT_RANGE_START = 42700;
const PORT_RANGE_END = 43700;
const MAX_INSTANCES = 25;
const LOCAL_SCOPE = "local";

const allocatedPorts = new Set<number>();
const instances = new Map<string, ManagedInstance>();
const spawnLocks = new Map<string, Promise<AgentInstance>>();

/**
 * Resolve the path to the python directory.
 */
function getPythonDir(): string {
  return resolve(__dirname, '..', '..', 'python');
}

function getMonorepoRoot(): string {
  return resolve(__dirname, '..', '..', '..', '..');
}

function getApiLibDir(): string {
  return resolve(__dirname, '.');
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ManagedInstance extends AgentInstance {
  idleTimer?: ReturnType<typeof setTimeout>;
  fingerprint?: string;
  /** Path to the workspace directory (manifests, spawn files). */
  workDir?: string;
  /** The child process running the gateway server. */
  process?: ChildProcess;
  /** tmux session when the agent runs outside the API process tree. */
  tmuxSession?: string;
  /** Poll timer for tmux-backed agents (no direct child process). */
  tmuxWatchTimer?: ReturnType<typeof setInterval>;
  /** Runtime LLM/search credentials for dispatch while this instance is alive. */
  runtimeSecrets?: RuntimeSecrets;
  /** True while a chat request is in flight — prevents idle reaping. */
  chatActive?: boolean;
}

// ---------------------------------------------------------------------------
// Port allocation
// ---------------------------------------------------------------------------

async function allocatePort(): Promise<number> {
  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    if (!allocatedPorts.has(port) && await isPortFree(port)) {
      allocatedPorts.add(port);
      return port;
    }
  }
  throw new Error('[Gateway] No available ports in range');
}

function releasePort(port: number) {
  allocatedPorts.delete(port);
}

/**
 * Check whether a port is free by briefly trying to listen on it.
 */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, '127.0.0.1', () => {
      srv.close(() => resolve(true));
    });
  });
}

// ---------------------------------------------------------------------------
// Instance fingerprinting
// ---------------------------------------------------------------------------

function buildFingerprint(config: AgentConfig): string {
  const parts: string[] = [
    config.runner || DEFAULT_AGENT_RUNNER_ID,
    config.provider.kind,
    config.provider.model,
    credentialsFingerprint(config.credentials),
    // NOTE: Don't include systemPrompt length — subagents like the document
    // editor inject changing context (slide content, selected slides) into the
    // prompt on every message, causing unnecessary respawns. The prompt is
    // passed via env var and the child process reads it at startup; subsequent
    // messages reuse the session so the updated context goes through chat history.
  ];

  if (config.enabledSpecialists?.length) {
    parts.push(
      'subagents:' +
        config.enabledSpecialists.map((s) => s.id).sort().join(','),
    );
  }
  if (config.approvalMode) parts.push(`approval:${config.approvalMode}`);

  return parts.join('|');
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Get or start an agent instance for the given workspace.
 */
export async function getOrStartInstance(
  workspaceId: string,
  subagentId: string,
  config: AgentConfig,
): Promise<AgentInstance> {
  const existingLock = spawnLocks.get(workspaceId);
  if (existingLock) {
    try {
      return await existingLock;
    } catch {
      // The other call failed; fall through to retry
    }
  }

  const lockPromise = doGetOrStart(workspaceId, subagentId, config);
  spawnLocks.set(workspaceId, lockPromise);

  try {
    return await lockPromise;
  } finally {
    if (spawnLocks.get(workspaceId) === lockPromise) {
      spawnLocks.delete(workspaceId);
    }
  }
}

async function doGetOrStart(
  workspaceId: string,
  subagentId: string,
  config: AgentConfig,
): Promise<AgentInstance> {
  const fingerprint = buildFingerprint(config);

  // Check for a running instance
  const existing = instances.get(workspaceId);
  if (existing && existing.status === 'running') {
    if (existing.fingerprint === fingerprint) {
      const runtimeSecrets = buildRuntimeSecrets(config);
      existing.runtimeSecrets = runtimeSecrets;
      setWorkspaceRuntimeSecrets(workspaceId, LOCAL_SCOPE, runtimeSecrets);
      touchInstance(existing);
      return existing;
    }
    console.log(
      `[Gateway] Invalidating instance for workspace ${workspaceId} (fingerprint changed)`,
    );
    await stopInstance(workspaceId);
  } else if (existing) {
    await stopInstance(workspaceId);
  }

  await evictIfAtCapacity();

  const scopeWorkspaceId = resolveToolHostWorkspaceId(workspaceId);
  ensureWorkspaceForToolHost({
    scopeWorkspaceId,
    gatewaySubagentId: subagentId,
  });

  const hostPort = await allocatePort();

  const instance: ManagedInstance = {
    id: workspaceId,
    subagentId,
    organizationId: LOCAL_SCOPE,
    runner: config.runner || DEFAULT_AGENT_RUNNER_ID,
    gatewayPort: hostPort,
    gatewayHost: '127.0.0.1',
    status: 'provisioning',
    lastActivity: new Date().toISOString(),
    fingerprint,
  };

  instances.set(workspaceId, instance);

  try {
    const workDir = join(tmpdir(), 'pimono', workspaceId);
    await mkdir(workDir, { recursive: true });
    instance.workDir = workDir;
    const dbPath = getLocalDbPath();

    // Kill any stale process on the allocated port
    await killProcessOnPort(hostPort);

    // 3. Spawn the runner adapter as a child process
    instance.status = 'starting';

    const pythonDir = getPythonDir();
    const projectRoot = getMonorepoRoot();
    const nodeModulesPath = join(projectRoot, 'node_modules');

    const runner = resolveServerRunner(config.runner);
    const runtimeSecrets = buildRuntimeSecrets(config);
    instance.runtimeSecrets = runtimeSecrets;
    setWorkspaceRuntimeSecrets(workspaceId, LOCAL_SCOPE, runtimeSecrets);
    if (!runtimeSecrets.apiKey?.trim() && runner.id === "pi") {
      console.warn(
        `[Gateway] No OpenRouter API key for ${workspaceId} — Pi-hosted tools ` +
          `(generate_slide, manage_design create/update, etc.) will fail. Add OpenRouter in Settings → API & Models ` +
          `or OPEN_ROUTER_API_KEY in .env.local.`,
      );
    }

    const spawnPlan = runner.buildSpawnPlan({
      workspaceId,
      subagentId,
      organizationId: LOCAL_SCOPE,
      port: hostPort,
      workDir,
      dbPath,
      config,
      nodeModulesPath,
      pythonDir,
    });

    const manifestPath = join(workDir, RUNNER_SESSION_MANIFEST_FILENAME);
    const manifest = buildRunnerSessionManifest({
      workspaceId,
      subagentId,
      organizationId: LOCAL_SCOPE,
      runner: config.runner || DEFAULT_AGENT_RUNNER_ID,
      gatewayPort: hostPort,
      dbPath: spawnPlan.env.DB_LOCAL_PATH,
      manifestPath,
    });
    writeRunnerSessionManifest(manifestPath, manifest);
    Object.assign(spawnPlan.env, {
      DUDE_SESSION_MANIFEST_PATH: manifestPath,
      DUDE_API_LIB_DIR: __dirname,
      DUDE_DISPATCH_CLI_PATH: join(__dirname, "runners", "dude-dispatch-cli.ts"),
      DB_LOCAL_PATH: manifest.internalApi.dbPath,
      DUDE_DB_PATH: manifest.internalApi.dbPath,
      DUDE_DISPATCH_CMD: manifest.dispatchCli,
      DUDE_API_PORT: resolveMainApiPort(),
      GATEWAY_INTERNAL_PORT: new URL(manifest.internalApi.baseUrl).port || "8787",
    });

    const spawnInProcess = () => {
      const child = spawn(spawnPlan.command, spawnPlan.args, {
        env: spawnPlan.env,
        cwd: spawnPlan.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      child.on('error', (err) => {
        console.error(`[Gateway] Failed to spawn agent process for ${workspaceId}:`, err.message);
        instance.status = 'error';
      });

      instance.process = child;
      instance.pid = child.pid;

      child.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().trim();
        if (lines) console.log(`[agent:${workspaceId.slice(0, 8)}] ${lines}`);
      });
      child.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().trim();
        if (lines) console.error(`[agent:${workspaceId.slice(0, 8)}] ${lines}`);
      });

      child.on('exit', (code, signal) => {
        const current = instances.get(workspaceId);
        if (current && current.status === 'running') {
          console.error(
            `[Gateway] Agent process for ${workspaceId} exited unexpectedly ` +
              `(code=${code}, signal=${signal})`,
          );
          current.status = 'error';
          if (current.chatActive) {
            console.error(
              `[Gateway] Agent for ${workspaceId} exited during an active chat turn — the turn will fail and can be retried`,
            );
            return;
          }
          cleanupInstance(workspaceId);
        }
      });

      console.log(
        `[Gateway] Agent process spawned for workspace ${workspaceId} ` +
          `(runner=${runner.id}, pid=${child.pid}, port=${hostPort})`,
      );
    };

    let spawnedInTmux = false;
    if (shouldSpawnAgentInTmux()) {
      spawnPlan.env.DUDE_CODEX_LOG = "1";
      const tmuxSessionName = buildTmuxSessionName(workspaceId);
      await killStaleWorkspaceAgent(
        workDir,
        tmuxSessionName,
        hostPort,
        killTmuxSession,
      );
      try {
        const tmuxSpawn = spawnAgentInTmux(
          workspaceId,
          spawnPlan,
          workDir,
          {
            launcherPath: join(getApiLibDir(), "agent-tmux-launcher.ts"),
            tsxEntry: join(nodeModulesPath, ".bin", "tsx"),
          },
          { skipSessionKill: true },
        );
        instance.tmuxSession = tmuxSpawn.sessionName;
        spawnedInTmux = true;

        console.log(
          `[Gateway] Agent process spawned in tmux for workspace ${workspaceId} ` +
            `(runner=${runner.id}, session=${tmuxSpawn.sessionName}, port=${hostPort})`,
        );
        console.log(
          `[Gateway] Attach to agent output: ${tmuxAttachCommand(tmuxSpawn.sessionName)}`,
        );
      } catch (error) {
        console.warn(
          `[Gateway] tmux spawn failed for ${workspaceId}, falling back to in-process:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    if (!spawnedInTmux) {
      spawnInProcess();
    }

    // 3. Poll the health endpoint until ready
    await waitForReady('127.0.0.1', hostPort, workDir);
    instance.status = 'running';

    if (instance.tmuxSession) {
      startTmuxSessionWatch(instance);
    }

    scheduleIdleReap(instance);
    return instance;
  } catch (error) {
    console.error(
      `[Gateway] Failed to start instance for workspace ${workspaceId}:`,
      error instanceof Error ? error.message : error,
    );
    instance.status = 'error';

    if (instance.tmuxSession) {
      const pane = captureTmuxPane(instance.tmuxSession);
      if (pane) {
        console.error(
          `[Gateway] tmux startup output for ${instance.tmuxSession}:\n${pane}`,
        );
      }
    }

    if (instance.tmuxSession && instance.workDir) {
      await killStaleWorkspaceAgent(
        instance.workDir,
        instance.tmuxSession,
        instance.gatewayPort,
        killTmuxSession,
      );
    } else if (instance.tmuxSession) {
      killTmuxSession(instance.tmuxSession);
      await killProcessOnPort(instance.gatewayPort);
    } else if (instance.process && !instance.process.killed) {
      instance.process.kill('SIGKILL');
    }

    cleanupInstance(workspaceId);
    throw error;
  }
}

/**
 * Stop and clean up an instance.
 */
export async function stopInstance(workspaceId: string): Promise<void> {
  const instance = instances.get(workspaceId);
  if (!instance) return;

  instance.status = 'stopping';

  if (instance.idleTimer) {
    clearTimeout(instance.idleTimer);
  }

  stopTmuxSessionWatch(instance);

  // 1. Stop the agent process
  if (instance.tmuxSession && instance.workDir) {
    await killStaleWorkspaceAgent(
      instance.workDir,
      instance.tmuxSession,
      instance.gatewayPort,
      killTmuxSession,
    );
  } else if (instance.tmuxSession) {
    killTmuxSession(instance.tmuxSession);
    await killProcessOnPort(instance.gatewayPort);
  } else if (instance.process && !instance.process.killed) {
    instance.process.kill('SIGTERM');
    // Give it a few seconds to clean up, then force kill
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (instance.process && !instance.process.killed) {
          instance.process.kill('SIGKILL');
        }
        resolve();
      }, 5_000);

      instance.process!.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  // Clean up the workspace directory
  if (instance.workDir) {
    rm(instance.workDir, { recursive: true, force: true }).catch(() => {});
  }

  cleanupInstance(workspaceId);
  console.log(`[Gateway] Instance stopped for workspace ${workspaceId}`);
}

/**
 * Get the current status of all managed instances.
 */
export function listInstances(): AgentInstance[] {
  return Array.from(instances.values()).map(
    ({
      idleTimer,
      fingerprint,
      workDir,
      process: _proc,
      tmuxWatchTimer: _watch,
      ...rest
    }) => ({
      ...rest,
      tmuxAttach: rest.tmuxSession
        ? tmuxAttachCommand(rest.tmuxSession)
        : undefined,
    }),
  );
}

/**
 * Get a specific instance by workspace ID.
 */
export function getInstance(workspaceId: string): AgentInstance | undefined {
  const instance = instances.get(workspaceId);
  if (!instance) return undefined;
  const {
    idleTimer,
    fingerprint,
    workDir,
    process: _proc,
    tmuxWatchTimer: _watch,
    ...rest
  } = instance;
  return {
    ...rest,
    tmuxAttach: rest.tmuxSession
      ? tmuxAttachCommand(rest.tmuxSession)
      : undefined,
  };
}

/**
 * Check if an instance is running for a workspace.
 */
export function hasRunningInstance(workspaceId: string): boolean {
  const instance = instances.get(workspaceId);
  return instance?.status === 'running';
}

// ---------------------------------------------------------------------------
// LRU eviction
// ---------------------------------------------------------------------------

async function evictIfAtCapacity(): Promise<void> {
  const running = Array.from(instances.values()).filter(
    (i) =>
      i.status === 'running' ||
      i.status === 'starting' ||
      i.status === 'provisioning',
  );

  if (running.length < MAX_INSTANCES) return;

  const lru = running.reduce((oldest, current) =>
    current.lastActivity < oldest.lastActivity ? current : oldest,
  );

  console.log(
    `[Gateway] At capacity (${MAX_INSTANCES}), evicting LRU instance ${lru.id}`,
  );

  await stopInstance(lru.id);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function touchInstance(instance: ManagedInstance) {
  instance.lastActivity = new Date().toISOString();
  scheduleIdleReap(instance);
}

/** Reset idle timer for an active instance (e.g. during long SSE streams). */
export function touchInstanceById(workspaceId: string) {
  const instance = instances.get(workspaceId);
  if (instance) touchInstance(instance);
}

/** Mark whether a chat is actively in flight — prevents idle reaping. */
export function setInstanceChatActive(workspaceId: string, active: boolean) {
  const instance = instances.get(workspaceId);
  if (instance) instance.chatActive = active;
  if (!active) {
    reapDeadInstanceAfterChat(workspaceId);
  }
}

/** Remove error-state instances once no chat turn is in flight. */
export function reapDeadInstanceAfterChat(workspaceId: string) {
  const instance = instances.get(workspaceId);
  if (!instance || instance.chatActive) return;
  if (instance.status === "error") {
    cleanupInstance(workspaceId);
  }
}

function scheduleIdleReap(instance: ManagedInstance) {
  if (instance.idleTimer) {
    clearTimeout(instance.idleTimer);
  }
  instance.idleTimer = setTimeout(() => {
    if (instance.chatActive) {
      // Chat still in progress — reschedule instead of killing
      scheduleIdleReap(instance);
      return;
    }
    console.log(`[Gateway] Reaping idle instance ${instance.id}`);
    stopInstance(instance.id);
  }, IDLE_TIMEOUT_MS);
}

function cleanupInstance(workspaceId: string) {
  const instance = instances.get(workspaceId);
  if (!instance) return;
  stopTmuxSessionWatch(instance);
  clearWorkspaceRuntimeSecrets(workspaceId);
  releasePort(instance.gatewayPort);
  instances.delete(workspaceId);
}

function stopTmuxSessionWatch(instance: ManagedInstance) {
  if (instance.tmuxWatchTimer) {
    clearInterval(instance.tmuxWatchTimer);
    instance.tmuxWatchTimer = undefined;
  }
}

function startTmuxSessionWatch(instance: ManagedInstance) {
  stopTmuxSessionWatch(instance);
  const sessionName = instance.tmuxSession;
  if (!sessionName) return;

  instance.tmuxWatchTimer = setInterval(() => {
    const current = instances.get(instance.id);
    if (!current || current.tmuxSession !== sessionName) {
      stopTmuxSessionWatch(instance);
      return;
    }
    if (current.status !== 'running' && current.status !== 'starting') {
      stopTmuxSessionWatch(instance);
      return;
    }
    if (!isTmuxSessionAlive(sessionName)) {
      const pane = captureTmuxPane(sessionName);
      console.error(
        `[Gateway] tmux session ${sessionName} ended for workspace ${instance.id}`,
      );
      if (pane) {
        console.error(
          `[Gateway] Last tmux output for ${sessionName}:\n${pane}`,
        );
      }
      current.status = "error";
      stopTmuxSessionWatch(instance);
      if (current.chatActive) {
        console.error(
          `[Gateway] Agent for ${instance.id} exited during an active chat turn — the turn will fail and can be retried`,
        );
        return;
      }
      cleanupInstance(instance.id);
    }
  }, 5_000);
}

// ---------------------------------------------------------------------------
// Periodic sweep — kills any instance idle for over 1 hour (safety net)
// ---------------------------------------------------------------------------

const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes
const MAX_IDLE_MS = 60 * 60 * 1000; // 1 hour

setInterval(() => {
  const now = Date.now();
  for (const instance of instances.values()) {
    if (instance.status !== 'running') continue;
    const idleMs = now - new Date(instance.lastActivity).getTime();
    if (idleMs > MAX_IDLE_MS) {
      console.log(
        `[Gateway] Sweep: reaping instance ${instance.id} (idle ${Math.round(idleMs / 60_000)}m)`,
      );
      stopInstance(instance.id);
    }
  }
}, SWEEP_INTERVAL_MS);

async function waitForReady(
  host: string,
  port: number,
  workDir?: string,
): Promise<void> {
  const url = `http://${host}:${port}/health`;
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  let hint = "";
  if (workDir) {
    const { readGatewayMarker, readSpawnFilePort } = await import(
      "./agent-gateway-marker.js"
    );
    const marker = readGatewayMarker(workDir);
    const spawnPort = readSpawnFilePort(workDir);
    if (marker?.port && marker.port !== port) {
      hint = ` (gateway marker reports port ${marker.port})`;
    } else if (spawnPort && spawnPort !== port) {
      hint = ` (spawn file reports port ${spawnPort})`;
    }
  }

  throw new Error(
    `[Gateway] Agent at ${host}:${port} failed to become ready within ${HEALTH_TIMEOUT_MS}ms${hint}`,
  );
}

registerInstanceRuntimeSecretsProvider(
  (workspaceId) => instances.get(workspaceId)?.runtimeSecrets,
);

registerSpawnFileRuntimeSecretsProvider(rehydrateRuntimeSecretsFromSpawnFile);
