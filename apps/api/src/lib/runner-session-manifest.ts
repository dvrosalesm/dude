/**
 * Build, persist, and load RunnerSessionManifest for agent adapters.
 */

import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import type {
  AgentDispatchRequest,
  AgentToolHostExecuteResponse,
} from "@dude/sdk/runner";
import {
  AGENT_DISPATCH_ROUTES,
  AGENT_TOOL_HOST_HEADERS,
  isRunnerSessionManifest,
  RUNNER_SESSION_MANIFEST_FILENAME,
  RUNNER_SESSION_MANIFEST_VERSION,
  RUNNER_SESSION_HEADERS,
  type RunnerSessionManifest,
} from "@dude/sdk/runner";
import { join } from "node:path";
import {
  resolveGatewaySubagentId,
  resolveToolHostWorkspaceId,
} from "./tool-host/resolve-subagent-id.js";
import { getLocalDbPath } from "./local-sqlite.js";

export {
  RUNNER_SESSION_MANIFEST_FILENAME,
  RUNNER_SESSION_MANIFEST_VERSION,
  isRunnerSessionManifest,
};
export type { RunnerSessionManifest };

function apiLibDir(): string {
  return (
    process.env.DUDE_API_LIB_DIR?.trim() ||
    join(process.cwd(), "apps/api/src/lib")
  );
}

export function resolveMainApiPort(): string {
  return String(
    process.env.DUDE_API_PORT ||
      process.env.PORT ||
      "8787",
  );
}

export function resolveInternalApiBaseUrl(): string {
  return `http://127.0.0.1:${resolveMainApiPort()}`;
}

export function resolveDispatchCliEntryPath(): string {
  if (process.env.DUDE_DISPATCH_CLI_PATH?.trim()) {
    return process.env.DUDE_DISPATCH_CLI_PATH.trim();
  }
  return join(apiLibDir(), "runners", "dude-dispatch-cli.ts");
}

export function buildDispatchCliCommand(manifestPath: string): string {
  const entry = resolveDispatchCliEntryPath();
  return `npx tsx ${entry} --manifest ${JSON.stringify(manifestPath)}`;
}

export interface BuildRunnerSessionManifestInput {
  workspaceId: string;
  subagentId: string;
  organizationId: string;
  runner: string;
  gatewayPort: number;
  dbPath?: string;
  manifestPath: string;
}

export function buildRunnerSessionManifest(
  input: BuildRunnerSessionManifestInput,
): RunnerSessionManifest {
  const workspaceId = resolveToolHostWorkspaceId(input.workspaceId);
  const subagentId = resolveGatewaySubagentId(input.subagentId);
  const dbPath = input.dbPath?.trim() || getLocalDbPath();
  const internalBaseUrl = resolveInternalApiBaseUrl();
  const sessionId = createHash("sha256")
    .update(`${workspaceId}:${subagentId}:${input.runner}:${randomUUID()}`)
    .digest("hex")
    .slice(0, 16);

  const manifest: RunnerSessionManifest = {
    version: RUNNER_SESSION_MANIFEST_VERSION,
    sessionId,
    workspaceId,
    subagentId,
    organizationId: input.organizationId,
    runner: input.runner,
    gatewayPort: input.gatewayPort,
    internalApi: {
      baseUrl: internalBaseUrl,
      dbPath,
    },
    dispatchCli: buildDispatchCliCommand(input.manifestPath),
    spawnedAt: new Date().toISOString(),
  };

  return manifest;
}

export function writeRunnerSessionManifest(
  manifestPath: string,
  manifest: RunnerSessionManifest,
): void {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function readRunnerSessionManifest(
  manifestPath: string,
): RunnerSessionManifest {
  const raw = readFileSync(manifestPath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!isRunnerSessionManifest(parsed)) {
    throw new Error(`Invalid runner session manifest: ${manifestPath}`);
  }
  return parsed;
}

export function loadRunnerSessionManifestFromEnv(): RunnerSessionManifest | null {
  const explicit = process.env.DUDE_SESSION_MANIFEST_PATH?.trim();
  if (explicit) {
    try {
      return readRunnerSessionManifest(explicit);
    } catch (error) {
      console.error(
        "[runner-session] Failed to load manifest from DUDE_SESSION_MANIFEST_PATH:",
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  const cwdDefault = join(process.cwd(), RUNNER_SESSION_MANIFEST_FILENAME);
  try {
    return readRunnerSessionManifest(cwdDefault);
  } catch {
    return null;
  }
}

/** Apply manifest fields to process.env for adapters that read env at runtime. */
export function applyRunnerSessionManifestToEnv(
  manifest: RunnerSessionManifest,
  manifestPath: string,
): void {
  process.env.DUDE_SESSION_MANIFEST_PATH = manifestPath;
  process.env.WORKSPACE_ID = manifest.workspaceId;
  process.env.SPECIALIST_ID = manifest.subagentId;
  process.env.ORGANIZATION_ID = manifest.organizationId;
  process.env.RUNNER_ID = manifest.runner;
  process.env.GATEWAY_PORT = String(manifest.gatewayPort);
  process.env.GATEWAY_INTERNAL_PORT = new URL(manifest.internalApi.baseUrl).port
    || "8787";
  process.env.DUDE_API_PORT =
    new URL(manifest.internalApi.baseUrl).port || "8787";
  process.env.DB_LOCAL_PATH = manifest.internalApi.dbPath;
  process.env.DUDE_DB_PATH = manifest.internalApi.dbPath;
  process.env.DUDE_DISPATCH_CMD = manifest.dispatchCli;
}

export function sessionHeadersFromManifest(
  manifest: RunnerSessionManifest,
): Record<string, string> {
  return {
    [RUNNER_SESSION_HEADERS.manifestVersion]: String(manifest.version),
    [RUNNER_SESSION_HEADERS.sessionId]: manifest.sessionId,
    [AGENT_TOOL_HOST_HEADERS.workspaceId]: manifest.workspaceId,
    [AGENT_TOOL_HOST_HEADERS.subagentId]: manifest.subagentId,
    [AGENT_TOOL_HOST_HEADERS.organizationId]: manifest.organizationId,
    [AGENT_TOOL_HOST_HEADERS.runnerId]: manifest.runner,
    [RUNNER_SESSION_HEADERS.dbLocalPath]: manifest.internalApi.dbPath,
  };
}

export async function dispatchViaManifest(
  manifest: RunnerSessionManifest,
  request: AgentDispatchRequest,
): Promise<AgentToolHostExecuteResponse> {
  const action = request.action?.trim();
  if (!action) {
    throw new Error("action is required");
  }

  const url = `${manifest.internalApi.baseUrl.replace(/\/+$/, "")}${AGENT_DISPATCH_ROUTES.dispatch}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...sessionHeadersFromManifest(manifest),
    },
    body: JSON.stringify({
      action,
      payload: request.payload ?? {},
      callId: request.callId?.trim() || `dispatch-${Date.now()}`,
    }),
    signal: AbortSignal.timeout(360_000),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: unknown }).error)
        : `Agent dispatch failed (${res.status})`;
    throw new Error(message);
  }

  return data as AgentToolHostExecuteResponse;
}
