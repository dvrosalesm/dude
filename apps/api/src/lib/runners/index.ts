/**
 * Server-side runner definitions — how each harness is spawned as a child process.
 */

import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AgentHarnessConfig,
  AgentRunnerId,
  AgentRunnerManifest,
  CustomRunnerRegistration,
} from "@dude/sdk/runner";
import {
  BUILTIN_RUNNER_IDS,
  DEFAULT_AGENT_RUNNER_ID,
  getAgentRunnerManifest,
  registerAgentRunnerManifest,
  resolveCodexCliBin,
  resolveHermesCliBin,
  type BuiltinRunnerId,
} from "@dude/sdk/runner";
import {
  buildRuntimeSecrets,
  runtimeSecretsToSpawnEnv,
} from "../runtime-config.js";
import { getLocalDbPath } from "../local-sqlite.js";
import { resolveMainApiPort } from "../runner-session-manifest.js";
import { DUDE_UI_MODE_ENV } from "../ui-input-mode.js";
import {
  resolveGatewaySubagentId,
  resolveToolHostWorkspaceId,
} from "../tool-host/resolve-subagent-id.js";

export interface RunnerSpawnContext {
  workspaceId: string;
  subagentId: string;
  organizationId: string;
  port: number;
  workDir: string;
  dbPath?: string;
  config: AgentHarnessConfig;
  nodeModulesPath: string;
  pythonDir: string;
}

export interface RunnerSpawnPlan {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
}

export interface ServerRunnerDefinition {
  id: AgentRunnerId;
  resolveServerEntry(): string;
  buildSpawnPlan(ctx: RunnerSpawnContext): RunnerSpawnPlan;
  checkAvailability?(): boolean;
}

function baseEnv(ctx: RunnerSpawnContext): Record<string, string> {
  const secrets = buildRuntimeSecrets(ctx.config);
  const dbPath = ctx.dbPath?.trim() || getLocalDbPath();

  return {
    PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
    HOME: process.env.HOME || "/root",
    LANG: process.env.LANG || "C.UTF-8",
    NODE_ENV: "production",
    NODE_PATH: ctx.nodeModulesPath,
    GATEWAY_PORT: String(ctx.port),
    SYSTEM_PROMPT: ctx.config.systemPrompt,
    DB_LOCAL_PATH: dbPath,
    DUDE_DB_PATH: dbPath,
    PYTHONPATH: ctx.pythonDir,
    WORKSPACE_ID: resolveToolHostWorkspaceId(ctx.workspaceId),
    SPECIALIST_ID: resolveGatewaySubagentId(ctx.subagentId),
    ORGANIZATION_ID: ctx.organizationId,
    GATEWAY_INTERNAL_PORT: gatewayInternalPort(),
    RUNNER_ID: ctx.config.runner || DEFAULT_AGENT_RUNNER_ID,
    [DUDE_UI_MODE_ENV]: "1",
    ...(ctx.config.enabledSpecialists?.length
      ? { ENABLED_SUBAGENTS: JSON.stringify(ctx.config.enabledSpecialists) }
      : {}),
    ...(ctx.config.approvalMode ? { APPROVAL_MODE: ctx.config.approvalMode } : {}),
    ...(ctx.config.maxIterations
      ? { MAX_ITERATIONS: String(ctx.config.maxIterations) }
      : {}),
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
    ...(process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
      ? {
          PUPPETEER_SKIP_CHROMIUM_DOWNLOAD:
            process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD,
        }
      : {}),
    ...runtimeSecretsToSpawnEnv(secrets),
  };
}

function apiSrcDir(): string {
  return resolve(fileURLToPath(new URL("../..", import.meta.url)));
}

function gatewayInternalPort(): string {
  return resolveMainApiPort();
}

function commandExists(name: string): boolean {
  try {
    execSync(`command -v ${name}`, { stdio: "ignore", timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

const piRunner: ServerRunnerDefinition = {
  id: "pi",
  resolveServerEntry() {
    return join(apiSrcDir(), "runners", "pi", "server.ts");
  },
  buildSpawnPlan(ctx) {
    return {
      command: "npx",
      args: ["tsx", this.resolveServerEntry()],
      env: baseEnv(ctx),
      cwd: ctx.workDir,
    };
  },
  checkAvailability() {
    return true;
  },
};

const codexRunner: ServerRunnerDefinition = {
  id: "codex",
  resolveServerEntry() {
    return join(apiSrcDir(), "runners", "codex-gateway", "server.ts");
  },
  buildSpawnPlan(ctx) {
    return {
      command: "npx",
      args: ["tsx", this.resolveServerEntry()],
      env: {
        ...baseEnv(ctx),
        CODEX_BIN: resolveCodexCliBin(ctx.config),
      },
      cwd: ctx.workDir,
    };
  },
  checkAvailability() {
    const bin = process.env.CODEX_BIN || "codex";
    return commandExists(bin);
  },
};

const hermesRunner: ServerRunnerDefinition = {
  id: "hermes",
  resolveServerEntry() {
    return join(apiSrcDir(), "runners", "hermes-gateway", "server.ts");
  },
  buildSpawnPlan(ctx) {
    return {
      command: "npx",
      args: ["tsx", this.resolveServerEntry()],
      env: {
        ...baseEnv(ctx),
        HERMES_BIN: resolveHermesCliBin(ctx.config),
      },
      cwd: ctx.workDir,
    };
  },
  checkAvailability() {
    return true;
  },
};

const cursorRunner: ServerRunnerDefinition = {
  id: "cursor",
  resolveServerEntry() {
    return join(apiSrcDir(), "runners", "cursor-gateway", "server.ts");
  },
  buildSpawnPlan(ctx) {
    return {
      command: "npx",
      args: ["tsx", this.resolveServerEntry()],
      env: baseEnv(ctx),
      cwd: ctx.workDir,
    };
  },
  checkAvailability() {
    return true;
  },
};

const BUILTIN_SERVER_RUNNERS: Record<BuiltinRunnerId, ServerRunnerDefinition> = {
  pi: piRunner,
  codex: codexRunner,
  hermes: hermesRunner,
  cursor: cursorRunner,
};

const RUNNERS = new Map<AgentRunnerId, ServerRunnerDefinition>(
  BUILTIN_RUNNER_IDS.map((id) => [id, BUILTIN_SERVER_RUNNERS[id]]),
);

for (const id of BUILTIN_RUNNER_IDS) {
  if (!BUILTIN_SERVER_RUNNERS[id]) {
    throw new Error(
      `[runners] Missing server definition for builtin runner "${id}"`,
    );
  }
}

export function createServerRunnerFromRegistration(
  registration: CustomRunnerRegistration,
  resolveEntry: (serverEntry: string) => string,
): ServerRunnerDefinition {
  const entry = resolveEntry(registration.serverEntry);

  return {
    id: registration.manifest.id,
    resolveServerEntry() {
      return entry;
    },
    buildSpawnPlan(ctx) {
      return {
        command: "npx",
        args: ["tsx", entry],
        env: baseEnv(ctx),
        cwd: ctx.workDir,
      };
    },
    checkAvailability: registration.checkAvailability,
  };
}

export function resolveServerRunner(id?: AgentRunnerId | null): ServerRunnerDefinition {
  const runnerId = (id || DEFAULT_AGENT_RUNNER_ID).trim() || DEFAULT_AGENT_RUNNER_ID;
  const runner = RUNNERS.get(runnerId);
  if (!runner) {
    throw new Error(
      `[runners] Unknown agent runner "${runnerId}". Registered: ${[...RUNNERS.keys()].join(", ")}`,
    );
  }
  return runner;
}

export function listServerRunners() {
  return [...RUNNERS.values()].map((runner) => {
    const manifest = getAgentRunnerManifest(runner.id);
    const available = runner.checkAvailability?.() ?? true;
    return {
      ...(manifest ?? {
        id: runner.id,
        label: runner.id,
        description: "",
        availability: "experimental" as const,
        harnessKind: "native" as const,
      }),
      available,
      serverEntry: runner.resolveServerEntry(),
    };
  });
}

export function registerServerRunner(
  definition: ServerRunnerDefinition,
  manifest?: AgentRunnerManifest,
) {
  RUNNERS.set(definition.id, definition);
  registerAgentRunnerManifest(
    manifest ??
      getAgentRunnerManifest(definition.id) ?? {
        id: definition.id,
        label: definition.id,
        description: "",
        availability: "experimental",
        harnessKind: "native",
      },
  );
}
