/**
 * Runner session manifest — typed contract between instance manager and adapters.
 *
 * Written to the agent workDir at spawn; adapters load it on startup.
 * All tool/dispatch calls must use manifest.internalApi — never ad-hoc ports or DB paths.
 */

import type { AgentRunnerId } from "./types.js";

export const RUNNER_SESSION_MANIFEST_VERSION = 1 as const;

export const RUNNER_SESSION_MANIFEST_FILENAME = ".dude-runner-session.json";

export const RUNNER_SESSION_HEADERS = {
  manifestVersion: "x-dude-manifest-version",
  dbLocalPath: "x-db-local-path",
  sessionId: "x-dude-session-id",
} as const;

export interface RunnerSessionInternalApi {
  /** Main Dude API base URL, e.g. http://127.0.0.1:8787 */
  baseUrl: string;
  /** Absolute path to the workspace SQLite database */
  dbPath: string;
}

export interface RunnerSessionManifest {
  version: typeof RUNNER_SESSION_MANIFEST_VERSION;
  /** Stable id for this spawn (workspace + runner + timestamp hash) */
  sessionId: string;
  workspaceId: string;
  specialistId: string;
  organizationId: string;
  runner: AgentRunnerId;
  /** This adapter's HTTP port (chat surface only) */
  gatewayPort: number;
  internalApi: RunnerSessionInternalApi;
  /** Absolute command prefix to invoke typed dispatch, e.g. `npx tsx /path/dude-dispatch-cli.ts` */
  dispatchCli: string;
  spawnedAt: string;
}

export function isRunnerSessionManifest(
  value: unknown,
): value is RunnerSessionManifest {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const internal = record.internalApi as Record<string, unknown> | undefined;
  return (
    record.version === RUNNER_SESSION_MANIFEST_VERSION &&
    typeof record.sessionId === "string" &&
    typeof record.workspaceId === "string" &&
    typeof record.specialistId === "string" &&
    typeof record.organizationId === "string" &&
    typeof record.runner === "string" &&
    typeof record.gatewayPort === "number" &&
    typeof record.dispatchCli === "string" &&
    typeof record.spawnedAt === "string" &&
    !!internal &&
    typeof internal.baseUrl === "string" &&
    typeof internal.dbPath === "string"
  );
}
