import { isBuiltinRunnerId } from "./builtins.js";
import type {
  AgentHarnessConfig,
  AgentHarnessCredentials,
  AgentRunnerSettings,
  CursorRunnerSettings,
  PiRunnerSettings,
} from "./types.js";

export { isBuiltinRunnerId } from "./builtins.js";

export type {
  AgentRunnerSettings,
  CodexRunnerSettings,
  CursorRunnerSettings,
  HermesRunnerSettings,
  PiRunnerSettings,
} from "./types.js";

export const DEFAULT_RUNNER_SETTINGS: Required<{
  pi: PiRunnerSettings;
  codex: { cliBin: string };
  hermes: { cliBin: string };
  cursor: { model: string };
}> = {
  pi: {
    maxIterations: 25,
    approvalMode: "auto",
  },
  codex: {
    cliBin: "codex",
  },
  hermes: {
    cliBin: "hermes",
  },
  cursor: {
    model: "composer-2.5",
  },
};

function trim(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next || undefined;
}

function normalizePiSettings(raw: unknown): PiRunnerSettings {
  const value =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as PiRunnerSettings)
      : {};
  const maxIterations =
    typeof value.maxIterations === "number" && value.maxIterations > 0
      ? Math.floor(value.maxIterations)
      : DEFAULT_RUNNER_SETTINGS.pi.maxIterations;
  const approvalMode =
    value.approvalMode === "draft" ||
    value.approvalMode === "per-step" ||
    value.approvalMode === "auto"
      ? value.approvalMode
      : DEFAULT_RUNNER_SETTINGS.pi.approvalMode;

  return { maxIterations, approvalMode };
}

function normalizeCliBinSettings(
  raw: unknown,
  fallback: string,
): { cliBin: string } {
  const value =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as { cliBin?: unknown })
      : {};
  const cliBin =
    typeof value.cliBin === "string" && value.cliBin.trim()
      ? value.cliBin.trim()
      : fallback;
  return { cliBin };
}

function normalizeCursorSettings(raw: unknown): CursorRunnerSettings {
  const value =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as CursorRunnerSettings)
      : {};
  return {
    apiKey: trim(value.apiKey),
    model: trim(value.model) ?? DEFAULT_RUNNER_SETTINGS.cursor.model,
  };
}

export function normalizeRunnerSettings(raw: unknown): AgentRunnerSettings {
  const parsed =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as AgentRunnerSettings)
      : {};

  return {
    pi: normalizePiSettings(parsed.pi),
    codex: normalizeCliBinSettings(parsed.codex, DEFAULT_RUNNER_SETTINGS.codex.cliBin),
    hermes: normalizeCliBinSettings(parsed.hermes, DEFAULT_RUNNER_SETTINGS.hermes.cliBin),
    cursor: normalizeCursorSettings(parsed.cursor),
  };
}

export type LegacyCursorCredentials = {
  cursor?: string;
  cursorModel?: string;
};

/** Migrate legacy cursor fields stored under runtime.credentials. */
export function migrateLegacyCursorCredentials(
  legacy: LegacyCursorCredentials | undefined,
  settings: AgentRunnerSettings,
): AgentRunnerSettings {
  const cursor = { ...settings.cursor };
  if (!cursor.apiKey && legacy?.cursor) {
    cursor.apiKey = trim(legacy.cursor);
  }
  if (!cursor.model && legacy?.cursorModel) {
    cursor.model = trim(legacy.cursorModel);
  }
  return { ...settings, cursor };
}

export function resolveCursorRunnerSettings(
  config: AgentHarnessConfig,
): Required<Pick<CursorRunnerSettings, "model">> & CursorRunnerSettings {
  const migrated = migrateLegacyCursorCredentials(
    undefined,
    normalizeRunnerSettings(config.runnerSettings),
  );
  const cursor = migrated.cursor ?? {};
  const model =
    trim(cursor.model) ??
    (config.provider.model.includes("/")
      ? DEFAULT_RUNNER_SETTINGS.cursor.model
      : config.provider.model) ??
    DEFAULT_RUNNER_SETTINGS.cursor.model;

  return {
    apiKey: trim(cursor.apiKey) ?? trim(config.credentials?.cursor),
    model,
  };
}

export function resolveCodexCliBin(config: AgentHarnessConfig): string {
  const settings = normalizeRunnerSettings(config.runnerSettings);
  return (
    trim(settings.codex?.cliBin) ||
    process.env.CODEX_BIN?.trim() ||
    DEFAULT_RUNNER_SETTINGS.codex.cliBin
  );
}

export function resolveHermesCliBin(config: AgentHarnessConfig): string {
  const settings = normalizeRunnerSettings(config.runnerSettings);
  return (
    trim(settings.hermes?.cliBin) ||
    process.env.HERMES_BIN?.trim() ||
    DEFAULT_RUNNER_SETTINGS.hermes.cliBin
  );
}

export function resolvePiRunnerSettings(
  config: AgentHarnessConfig,
  options: { isMainAssistant?: boolean } = {},
): Required<PiRunnerSettings> {
  const settings = normalizeRunnerSettings(config.runnerSettings).pi ?? {};
  const fallbackMax = options.isMainAssistant ? 12 : 25;
  return {
    maxIterations:
      typeof settings.maxIterations === "number" && settings.maxIterations > 0
        ? settings.maxIterations
        : config.maxIterations ?? fallbackMax,
    approvalMode:
      settings.approvalMode ?? config.approvalMode ?? DEFAULT_RUNNER_SETTINGS.pi.approvalMode!,
  };
}

