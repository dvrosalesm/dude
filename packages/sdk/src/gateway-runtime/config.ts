/**
 * Gateway tool runtime config — reads session env vars set by the Tool Host
 * or runner adapter before dispatching specialist actions.
 */

function env(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  get port() {
    return envInt("GATEWAY_PORT", 8080);
  },
  get systemPrompt() {
    return env("SYSTEM_PROMPT", "You are a data analyst.");
  },
  get modelProvider() {
    return env("MODEL_PROVIDER", "openrouter");
  },
  get modelId() {
    return env("MODEL_ID", "minimax/minimax-m2.7");
  },
  get apiKey() {
    return env("API_KEY", "");
  },
  get dbPath() {
    return (
      env("DB_LOCAL_PATH") ||
      env("DUDE_DB_PATH") ||
      ""
    );
  },
  get firecrawlUrl() {
    return env("FIRECRAWL_URL", "").replace(/\/+$/, "");
  },
  get firecrawlKey() {
    return env("FIRECRAWL_KEY", "");
  },
  get exaApiKey() {
    return env("EXA_API_KEY", "");
  },
  get workspaceId() {
    return env("WORKSPACE_ID", "");
  },
  get organizationId() {
    return env("ORGANIZATION_ID", "");
  },
  get specialistId() {
    return env("SPECIALIST_ID", "");
  },
  get gatewayInternalPort() {
    return env("DUDE_API_PORT") || env("GATEWAY_INTERNAL_PORT", "8787");
  },
  get approvalMode() {
    return env("APPROVAL_MODE", "auto") as "auto" | "draft" | "per-step";
  },
  get maxIterations() {
    return envInt("MAX_ITERATIONS", 25);
  },
};

export type GatewayRuntimeConfig = typeof config;
