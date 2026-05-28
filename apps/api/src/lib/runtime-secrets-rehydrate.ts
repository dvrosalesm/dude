/**
 * Rehydrate in-memory runtime secrets after API restart while agents keep running.
 * Reads credentials from the persisted tmux spawn file in the agent workDir.
 */

import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RuntimeSecrets } from "./runtime-config.js";
import { setWorkspaceRuntimeSecrets } from "./runtime-secrets-store.js";

interface AgentSpawnFile {
  env?: Record<string, string>;
}

function workspaceWorkDir(workspaceId: string): string {
  return join(tmpdir(), "pimono", workspaceId);
}

function trim(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next || undefined;
}

function secretsFromSpawnEnv(env: Record<string, string>): RuntimeSecrets | null {
  const apiKey = trim(env.API_KEY);
  if (!apiKey) return null;

  return {
    apiKey,
    modelProvider: trim(env.MODEL_PROVIDER) || "openrouter",
    modelId: trim(env.MODEL_ID) || "",
    firecrawlUrl: trim(env.FIRECRAWL_URL),
    firecrawlKey: trim(env.FIRECRAWL_KEY),
    exaApiKey: trim(env.EXA_API_KEY),
    geminiApiKey: trim(env.GEMINI_API_KEY),
    cursorApiKey: trim(env.CURSOR_API_KEY),
    cursorModel: trim(env.CURSOR_MODEL),
  };
}

export function rehydrateRuntimeSecretsFromSpawnFile(
  workspaceId: string,
  organizationId = "local",
): RuntimeSecrets | undefined {
  const spawnPath = join(workspaceWorkDir(workspaceId), ".dude-agent-spawn.json");
  if (!existsSync(spawnPath)) return undefined;

  try {
    const parsed = JSON.parse(
      readFileSync(spawnPath, "utf8"),
    ) as AgentSpawnFile;
    const secrets = secretsFromSpawnEnv(parsed.env ?? {});
    if (!secrets) return undefined;

    setWorkspaceRuntimeSecrets(workspaceId, organizationId, secrets);
    console.log(
      `[runtime-secrets] Rehydrated secrets for ${workspaceId} from spawn file`,
    );
    return secrets;
  } catch (error) {
    console.warn(
      `[runtime-secrets] Failed to rehydrate from spawn file for ${workspaceId}:`,
      error instanceof Error ? error.message : error,
    );
    return undefined;
  }
}
