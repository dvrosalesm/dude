export type DudeTheme = "bone";

import {
  DEFAULT_AGENT_RUNNER_ID,
  DEFAULT_RUNNER_SETTINGS,
  listAgentRunners,
  migrateLegacyCursorCredentials,
  normalizeRunnerSettings,
  normalizeStoredAgentRunnerId,
  type AgentHarnessCredentials,
  type AgentRunnerId,
  type AgentRunnerSettings,
  type LlmProviderKind,
} from "@dude/sdk/runner";

export { listAgentRunners };

export const DUDE_PREFERENCES_KEY = "dude.local.preferences.v1";

export type LocalMcpServerConfig = {
  id: string;
  name: string;
  transport: "http" | "sse" | "stdio";
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
};

export type LocalSourceToolConfig = {
  id: string;
  name: string;
  description: string;
  endpoint?: string;
  schema?: Record<string, unknown>;
  enabled: boolean;
};

export type LocalSkillConfig = {
  id: string;
  name: string;
  description: string;
  source: "registry" | "local" | "github" | "inline";
  reference?: string;
  trigger?: string;
  instructions?: string;
  config?: Record<string, string>;
  enabled: boolean;
};

export type DudeAppConfigurations = {
  mcpServers: LocalMcpServerConfig[];
  sourceTools: LocalSourceToolConfig[];
  skills: LocalSkillConfig[];
};

export type DudeRuntimeCredentials = AgentHarnessCredentials;

export type DudeRuntimeSettings = {
  provider: {
    kind: LlmProviderKind;
    model: string;
    endpoint?: string;
  };
  credentials: DudeRuntimeCredentials;
};

export type DudePreferences = {
  assistantName: string;
  theme: DudeTheme;
  /** Background agent harness (pi, codex, hermes, cursor). */
  agentRunner: AgentRunnerId;
  /** Per-runner settings (CLI paths, Cursor SDK keys, Pi loop limits). */
  runnerConfigs: AgentRunnerSettings;
  /** LLM provider, model, and BYOK API keys. */
  runtime: DudeRuntimeSettings;
  appConfigurations: DudeAppConfigurations;
};

const DEFAULT_APP_CONFIGURATIONS: DudeAppConfigurations = {
  mcpServers: [],
  sourceTools: [],
  skills: [],
};

export const DEFAULT_RUNTIME_SETTINGS: DudeRuntimeSettings = {
  provider: {
    kind: "openrouter",
    model: "deepseek/deepseek-v4-pro",
  },
  credentials: {},
};

export const DEFAULT_PREFERENCES: DudePreferences = {
  assistantName: "Dude",
  theme: "bone",
  agentRunner: DEFAULT_AGENT_RUNNER_ID,
  runnerConfigs: normalizeRunnerSettings(undefined),
  runtime: DEFAULT_RUNTIME_SETTINGS,
  appConfigurations: DEFAULT_APP_CONFIGURATIONS,
};

export type ParsedLocalAppConfigurations = {
  mcpServers: LocalMcpServerConfig[];
  sourceTools: LocalSourceToolConfig[];
  skills: LocalSkillConfig[];
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseLegacyJsonArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeEnv(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key, envValue]) => key.trim() && typeof envValue === "string")
    .map(([key, envValue]) => [key.trim(), envValue as string]);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function normalizeMcpServers(raw: unknown): LocalMcpServerConfig[] {
  return parseLegacyJsonArray(raw)
    .map((item): LocalMcpServerConfig | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const value = item as Record<string, unknown>;
      const name = typeof value.name === "string" ? value.name.trim() : "";
      if (!name) return null;
      const transport =
        value.transport === "stdio" || value.transport === "sse" || value.transport === "http"
          ? value.transport
          : "http";
      const args =
        typeof value.args === "string"
          ? value.args.split(/\s+/).filter(Boolean)
          : Array.isArray(value.args)
            ? value.args.filter((arg): arg is string => typeof arg === "string")
            : undefined;
      return {
        id:
          typeof value.id === "string" && value.id.trim()
            ? value.id.trim()
            : createId("mcp"),
        name,
        transport,
        url:
          typeof value.url === "string" && value.url.trim()
            ? value.url.trim()
            : undefined,
        command:
          typeof value.command === "string" && value.command.trim()
            ? value.command.trim()
            : undefined,
        args,
        env: normalizeEnv(value.env),
        enabled: value.enabled !== false,
      };
    })
    .filter((item): item is LocalMcpServerConfig => item !== null);
}

export function normalizeSourceTools(raw: unknown): LocalSourceToolConfig[] {
  return parseLegacyJsonArray(raw)
    .map((item): LocalSourceToolConfig | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const value = item as Record<string, unknown>;
      const name = typeof value.name === "string" ? value.name.trim() : "";
      const description =
        typeof value.description === "string" ? value.description.trim() : "";
      if (!name) return null;
      return {
        id:
          typeof value.id === "string" && value.id.trim()
            ? value.id.trim()
            : createId("tool"),
        name,
        description,
        endpoint:
          typeof value.endpoint === "string" && value.endpoint.trim()
            ? value.endpoint.trim()
            : undefined,
        schema:
          value.schema && typeof value.schema === "object" && !Array.isArray(value.schema)
            ? (value.schema as Record<string, unknown>)
            : undefined,
        enabled: value.enabled !== false,
      };
    })
    .filter((item): item is LocalSourceToolConfig => item !== null);
}

export function normalizeSkills(raw: unknown): LocalSkillConfig[] {
  return parseLegacyJsonArray(raw)
    .map((item): LocalSkillConfig | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const value = item as Record<string, unknown>;
      const name = typeof value.name === "string" ? value.name.trim() : "";
      if (!name) return null;
      const source =
        value.source === "local" ||
        value.source === "github" ||
        value.source === "inline" ||
        value.source === "registry"
          ? value.source
          : "registry";
      return {
        id:
          typeof value.id === "string" && value.id.trim()
            ? value.id.trim()
            : createId("skill"),
        name,
        description:
          typeof value.description === "string" ? value.description.trim() : "",
        source,
        reference:
          typeof value.reference === "string" && value.reference.trim()
            ? value.reference.trim()
            : undefined,
        trigger:
          typeof value.trigger === "string" && value.trigger.trim()
            ? value.trigger.trim()
            : undefined,
        instructions:
          typeof value.instructions === "string" && value.instructions.trim()
            ? value.instructions.trim()
            : undefined,
        config: normalizeEnv(value.config),
        enabled: value.enabled !== false,
      };
    })
    .filter((item): item is LocalSkillConfig => item !== null);
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeRuntimeCredentials(raw: unknown): DudeRuntimeCredentials {
  const value =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    openrouter: normalizeOptionalString(value.openrouter),
    openai: normalizeOptionalString(value.openai),
    groq: normalizeOptionalString(value.groq),
    firecrawlUrl: normalizeOptionalString(value.firecrawlUrl),
    firecrawlKey: normalizeOptionalString(value.firecrawlKey),
    exa: normalizeOptionalString(value.exa),
    gemini: normalizeOptionalString(value.gemini),
  };
}

function normalizeRuntimeSettings(raw: unknown): DudeRuntimeSettings {
  const parsed =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Partial<DudeRuntimeSettings>)
      : {};
  const providerRaw =
    parsed.provider && typeof parsed.provider === "object"
      ? (parsed.provider as Partial<DudeRuntimeSettings["provider"]>)
      : {};
  const kind: LlmProviderKind =
    providerRaw.kind === "openai" ||
    providerRaw.kind === "openai-codex" ||
    providerRaw.kind === "groq" ||
    providerRaw.kind === "ollama" ||
    providerRaw.kind === "openrouter"
      ? providerRaw.kind
      : DEFAULT_RUNTIME_SETTINGS.provider.kind;
  const model =
    typeof providerRaw.model === "string" && providerRaw.model.trim()
      ? providerRaw.model.trim()
      : DEFAULT_RUNTIME_SETTINGS.provider.model;

  return {
    provider: {
      kind,
      model,
      endpoint: normalizeOptionalString(providerRaw.endpoint),
    },
    credentials: normalizeRuntimeCredentials(parsed.credentials),
  };
}

function readLegacyCursorCredentials(
  parsed: Partial<DudePreferences>,
): AgentHarnessCredentials {
  const creds =
    parsed.runtime &&
    typeof parsed.runtime === "object" &&
    parsed.runtime.credentials &&
    typeof parsed.runtime.credentials === "object"
      ? (parsed.runtime.credentials as Record<string, unknown>)
      : {};
  return {
    cursor: normalizeOptionalString(creds.cursor),
    cursorModel: normalizeOptionalString(creds.cursorModel),
  };
}

export function normalizePreferences(raw: unknown): DudePreferences {
  const parsed = raw && typeof raw === "object" ? (raw as Partial<DudePreferences>) : {};
  const rawAppConfig: Record<string, unknown> =
    parsed.appConfigurations && typeof parsed.appConfigurations === "object"
      ? (parsed.appConfigurations as unknown as Record<string, unknown>)
      : {};

  const legacyCursorCredentials = readLegacyCursorCredentials(parsed);
  const runtime = normalizeRuntimeSettings(parsed.runtime);
  const runnerConfigs = migrateLegacyCursorCredentials(
    legacyCursorCredentials,
    normalizeRunnerSettings(parsed.runnerConfigs),
  );

  const agentRunnerRaw =
    typeof parsed.agentRunner === "string" ? parsed.agentRunner.trim() : "";

  return {
    assistantName:
      typeof parsed.assistantName === "string" && parsed.assistantName.trim()
        ? parsed.assistantName.trim()
        : DEFAULT_PREFERENCES.assistantName,
    theme: "bone",
    agentRunner: normalizeStoredAgentRunnerId(agentRunnerRaw),
    runnerConfigs,
    runtime,
    appConfigurations: {
      mcpServers: normalizeMcpServers(
        "mcpServers" in rawAppConfig
          ? rawAppConfig.mcpServers
          : rawAppConfig.mcpServersJson,
      ),
      sourceTools: normalizeSourceTools(
        "sourceTools" in rawAppConfig
          ? rawAppConfig.sourceTools
          : rawAppConfig.sourceToolsJson,
      ),
      skills: normalizeSkills(rawAppConfig.skills),
    },
  };
}

export function readStoredPreferences(): DudePreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(DUDE_PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return normalizePreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function parseLocalAppConfigurations(
  appConfigurations: DudeAppConfigurations,
): ParsedLocalAppConfigurations {
  return {
    mcpServers: normalizeMcpServers(appConfigurations.mcpServers),
    sourceTools: normalizeSourceTools(appConfigurations.sourceTools),
    skills: normalizeSkills(appConfigurations.skills),
  };
}
