import type {
  AgentHarnessConfig,
  AgentHarnessCredentials,
  LlmProviderKind,
} from "@dude/sdk/runner";
import { resolveCursorRunnerSettings } from "@dude/sdk/runner";

export interface RuntimeSecrets {
  apiKey: string;
  modelProvider: string;
  modelId: string;
  firecrawlUrl?: string;
  firecrawlKey?: string;
  exaApiKey?: string;
  geminiApiKey?: string;
  cursorApiKey?: string;
  cursorModel?: string;
}

function trim(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next || undefined;
}

const PROVIDER_API_KEY_ENV: Partial<Record<LlmProviderKind, string>> = {
  openrouter: "OPEN_ROUTER_API_KEY",
  openai: "OPENAI_API_KEY",
  "openai-codex": "OPENAI_API_KEY",
  groq: "GROQ_API_KEY",
};

function resolveEnvValue(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = trim(process.env[key]);
    if (value) return value;
  }
  return undefined;
}

function resolveEnvProviderApiKey(kind: LlmProviderKind): string {
  const envVar = PROVIDER_API_KEY_ENV[kind];
  if (envVar) {
    const fromProviderEnv = resolveEnvValue(envVar);
    if (fromProviderEnv) return fromProviderEnv;
  }
  return resolveEnvValue("API_KEY") ?? "";
}

/**
 * API key for specialist tools (generate_slide, design doc, etc.).
 * These run on the Dude API and call OpenRouter — independent of Codex CLI auth.
 */
export function resolveToolHostApiKey(
  provider: AgentHarnessConfig["provider"],
  credentials?: AgentHarnessCredentials,
): string {
  const creds = credentials ?? {};
  const openrouter =
    trim(creds.openrouter) ?? resolveEnvValue("OPEN_ROUTER_API_KEY");
  if (openrouter) return openrouter;

  return resolveProviderApiKey(provider, credentials);
}

export function resolveProviderApiKey(
  provider: AgentHarnessConfig["provider"],
  credentials?: AgentHarnessCredentials,
): string {
  const direct = trim(provider.apiKey);
  if (direct) return direct;

  const creds = credentials ?? {};
  let fromCredentials = "";
  switch (provider.kind) {
    case "openrouter":
      fromCredentials = trim(creds.openrouter) ?? "";
      break;
    case "openai":
    case "openai-codex":
      fromCredentials = trim(creds.openai) ?? "";
      break;
    case "groq":
      fromCredentials = trim(creds.groq) ?? "";
      break;
    default:
      fromCredentials = "";
  }
  if (fromCredentials) return fromCredentials;

  return resolveEnvProviderApiKey(provider.kind);
}

export function buildRuntimeSecrets(config: AgentHarnessConfig): RuntimeSecrets {
  const credentials = config.credentials ?? {};
  const cursorSettings = resolveCursorRunnerSettings(config);

  return {
    apiKey: resolveToolHostApiKey(config.provider, credentials),
    modelProvider:
      config.provider.kind === "openrouter"
        ? "openrouter"
        : config.provider.kind,
    modelId: config.provider.model,
    firecrawlUrl: trim(credentials.firecrawlUrl) ?? resolveEnvValue("FIRECRAWL_URL"),
    firecrawlKey: trim(credentials.firecrawlKey) ?? resolveEnvValue("FIRECRAWL_KEY"),
    exaApiKey: trim(credentials.exa) ?? resolveEnvValue("EXA_API_KEY"),
    geminiApiKey: trim(credentials.gemini) ?? resolveEnvValue("GEMINI_API_KEY"),
    cursorApiKey: cursorSettings.apiKey ?? resolveEnvValue("CURSOR_API_KEY"),
    cursorModel: cursorSettings.model,
  };
}

export function runtimeSecretsToSpawnEnv(
  secrets: RuntimeSecrets,
): Record<string, string> {
  const env: Record<string, string> = {
    MODEL_PROVIDER: secrets.modelProvider,
    MODEL_ID: secrets.modelId,
  };

  if (secrets.apiKey) env.API_KEY = secrets.apiKey;
  if (secrets.firecrawlUrl) env.FIRECRAWL_URL = secrets.firecrawlUrl;
  if (secrets.firecrawlKey) env.FIRECRAWL_KEY = secrets.firecrawlKey;
  if (secrets.exaApiKey) env.EXA_API_KEY = secrets.exaApiKey;
  if (secrets.geminiApiKey) env.GEMINI_API_KEY = secrets.geminiApiKey;
  if (secrets.cursorApiKey) env.CURSOR_API_KEY = secrets.cursorApiKey;
  if (secrets.cursorModel) env.CURSOR_MODEL = secrets.cursorModel;

  return env;
}

export function credentialsFingerprint(
  credentials?: AgentHarnessCredentials,
): string {
  if (!credentials) return "";
  const entries = Object.entries(credentials)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return "";
  return JSON.stringify(Object.fromEntries(entries));
}

export function defaultModelForProvider(kind: LlmProviderKind): string {
  switch (kind) {
    case "openai":
    case "openai-codex":
      return "gpt-4.1";
    case "groq":
      return "llama-3.3-70b-versatile";
    case "ollama":
      return "llama3.2";
    case "openrouter":
    default:
      return "deepseek/deepseek-v4-pro";
  }
}
