import type { AgentRunnerId } from "@dude/sdk/runner";
import {
  ensureWorkspaceRuntimeSecrets,
} from "../runtime-secrets-store.js";
import { resolveMainApiPort } from "../runner-session-manifest.js";
import { getLocalDbPath } from "../local-sqlite.js";
import { resolveGatewaySpecialistId } from "./resolve-specialist-id.js";
import { withRequestDbPath } from "../request-db-context.js";

export interface ToolHostSession {
  workspaceId: string;
  specialistId: string;
  organizationId: string;
  runner: AgentRunnerId;
}

const SESSION_ENV_KEYS = [
  "WORKSPACE_ID",
  "SPECIALIST_ID",
  "ORGANIZATION_ID",
  "RUNNER_ID",
  "ENABLED_SPECIALISTS",
  "APPROVAL_MODE",
  "MAX_ITERATIONS",
  "API_KEY",
  "MODEL_PROVIDER",
  "MODEL_ID",
  "DB_LOCAL_PATH",
  "DUDE_DB_PATH",
  "FIRECRAWL_URL",
  "FIRECRAWL_KEY",
  "EXA_API_KEY",
  "GATEWAY_INTERNAL_PORT",
] as const;

type EnvSnapshot = Partial<Record<(typeof SESSION_ENV_KEYS)[number], string>>;

export function snapshotToolHostEnv(): EnvSnapshot {
  const snap: EnvSnapshot = {};
  for (const key of SESSION_ENV_KEYS) {
    if (process.env[key] !== undefined) {
      snap[key] = process.env[key];
    }
  }
  return snap;
}

export function applyToolHostSession(
  session: ToolHostSession,
  extras?: Record<string, string | undefined>,
) {
  process.env.WORKSPACE_ID = session.workspaceId;
  process.env.SPECIALIST_ID = resolveGatewaySpecialistId(session.specialistId);
  process.env.ORGANIZATION_ID = session.organizationId;
  process.env.RUNNER_ID = session.runner;

  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

export function restoreToolHostEnv(snapshot: EnvSnapshot) {
  for (const key of SESSION_ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

export async function withToolHostSession<T>(
  session: ToolHostSession,
  extras: Record<string, string | undefined> | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const snap = snapshotToolHostEnv();
  applyToolHostSession(session, extras);
  const dbPath =
    extras?.DB_LOCAL_PATH?.trim() || process.env.DB_LOCAL_PATH?.trim();
  try {
    return await withRequestDbPath(dbPath, fn);
  } finally {
    restoreToolHostEnv(snap);
  }
}

export function parseToolHostSessionFromHeaders(
  headers: Headers,
): ToolHostSession | null {
  const workspaceId = headers.get("x-workspace-id")?.trim();
  const specialistId = headers.get("x-specialist-id")?.trim();
  const organizationId =
    headers.get("x-scope-id")?.trim() ||
    headers.get("x-organization-id")?.trim() ||
    "local";
  const runner = (headers.get("x-runner-id")?.trim() || "pi") as AgentRunnerId;

  if (!workspaceId || !specialistId) {
    return null;
  }

  return {
    workspaceId,
    specialistId: resolveGatewaySpecialistId(specialistId),
    organizationId,
    runner,
  };
}

export function toolHostEnvExtrasForWorkspace(
  workspaceId: string,
): Record<string, string | undefined> {
  const mainApiPort = resolveMainApiPort();
  const dbPath = getLocalDbPath();
  const secrets = ensureWorkspaceRuntimeSecrets(workspaceId);
  const apiKey =
    secrets?.apiKey ||
    process.env.OPEN_ROUTER_API_KEY?.trim() ||
    process.env.API_KEY?.trim() ||
    undefined;
  const dbEnv = {
    DB_LOCAL_PATH: dbPath,
    DUDE_DB_PATH: dbPath,
    GATEWAY_INTERNAL_PORT: mainApiPort,
    DUDE_API_PORT: mainApiPort,
  };

  if (!secrets && !apiKey) {
    return dbEnv;
  }

  return {
    API_KEY: apiKey,
    MODEL_PROVIDER: secrets?.modelProvider || process.env.MODEL_PROVIDER || "openrouter",
    MODEL_ID: secrets?.modelId || process.env.MODEL_ID,
    FIRECRAWL_URL: secrets?.firecrawlUrl,
    FIRECRAWL_KEY: secrets?.firecrawlKey,
    EXA_API_KEY: secrets?.exaApiKey,
    GEMINI_API_KEY: secrets?.geminiApiKey,
    ...dbEnv,
  };
}

/** Compose tool-host env from session headers (workspace secrets + optional overrides). */
export function toolHostEnvExtrasFromHeaders(
  headers: Headers,
): Record<string, string | undefined> {
  const workspaceId = headers.get("x-workspace-id")?.trim();
  const enabledSpecialists = headers.get("x-enabled-specialists");
  const dbLocalPath = headers.get("x-db-local-path");
  const base = workspaceId
    ? toolHostEnvExtrasForWorkspace(workspaceId)
    : {
        GATEWAY_INTERNAL_PORT: resolveMainApiPort(),
        DUDE_API_PORT: resolveMainApiPort(),
      };

  return {
    ...base,
    ...(enabledSpecialists ? { ENABLED_SPECIALISTS: enabledSpecialists } : {}),
    ...(dbLocalPath
      ? { DB_LOCAL_PATH: dbLocalPath, DUDE_DB_PATH: dbLocalPath }
      : {}),
  };
}
