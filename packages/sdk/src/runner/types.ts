/**
 * Agent runner contract — shared between client, API gateway, and harness adapters.
 *
 * Every background runner (Pi, Codex, Hermes, …) exposes the same HTTP surface
 * on a localhost port. The API instance manager spawns the adapter; the adapter
 * bridges to the native harness CLI/SDK.
 */

import type { BuiltinRunnerId } from "./builtins.js";

/** Built-in runner ids. Custom runners may register additional string ids. */
export type AgentRunnerId = BuiltinRunnerId | (string & {});

export const DEFAULT_AGENT_RUNNER_ID: AgentRunnerId = "pi";

export type AgentRunnerAvailability = "ready" | "missing" | "experimental";

/** How the harness executes tool loops and content generation. */
export type AgentRunnerHarnessKind = "hosted" | "native";

export interface AgentRunnerManifest {
  id: AgentRunnerId;
  label: string;
  description: string;
  availability: AgentRunnerAvailability;
  /**
   * `hosted` — Pi-style; API may run secondary LLM tools (e.g. generate_slide).
   * `native` — harness LLM writes content; hosted LLM tools are filtered out.
   */
  harnessKind: AgentRunnerHarnessKind;
  /** CLI binary or package the adapter expects (for install hints). */
  installHint?: string;
  homepage?: string;
}

// ---------------------------------------------------------------------------
// Harness configuration (runner-agnostic — passed when spawning an instance)
// ---------------------------------------------------------------------------

export type LlmProviderKind =
  | "openrouter"
  | "openai"
  | "openai-codex"
  | "groq"
  | "ollama";

/** BYOK credentials configured in app settings (not .env). */
export interface AgentHarnessCredentials {
  openrouter?: string;
  openai?: string;
  groq?: string;
  firecrawlUrl?: string;
  firecrawlKey?: string;
  exa?: string;
  gemini?: string;
}

export interface AgentHarnessProvider {
  kind: LlmProviderKind;
  model: string;
  endpoint?: string;
  temperature?: number;
  /** Optional direct override for the active provider key. */
  apiKey?: string;
}

export interface AgentHarnessToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  mode: "local" | "http";
  endpoint?: string;
  handler?: string;
}

export type PiRunnerSettings = {
  maxIterations?: number;
  approvalMode?: "auto" | "draft" | "per-step";
};

export type CodexRunnerSettings = {
  cliBin?: string;
};

export type HermesRunnerSettings = {
  cliBin?: string;
};

export type CursorRunnerSettings = {
  apiKey?: string;
  model?: string;
};

export type AgentRunnerSettings = {
  pi?: PiRunnerSettings;
  codex?: CodexRunnerSettings;
  hermes?: HermesRunnerSettings;
  cursor?: CursorRunnerSettings;
};

export interface AgentHarnessConfig {
  /** Which harness adapter to spawn. Defaults to `pi`. */
  runner?: AgentRunnerId;
  provider: AgentHarnessProvider;
  systemPrompt: string;
  tools: AgentHarnessToolDef[];
  maxIterations?: number;
  approvalMode?: "auto" | "draft" | "per-step";
  enabledSpecialists?: Array<{
    id: string;
    label?: string;
    description?: string;
  }>;
  /** Optional app-level MCP / source-tool / skill configs forwarded to the harness. */
  mcpServers?: unknown[];
  sourceTools?: unknown[];
  skills?: unknown[];
  /** Per-runner configuration (Pi iterations, Codex/Hermes CLI paths, Cursor SDK keys). */
  runnerSettings?: AgentRunnerSettings;
  /** User-provided API keys and integration secrets (from app settings). */
  credentials?: AgentHarnessCredentials;
}

// ---------------------------------------------------------------------------
// Standard HTTP protocol (every runner adapter must implement)
// ---------------------------------------------------------------------------

export type AgentInstanceStatus =
  | "starting"
  | "provisioning"
  | "running"
  | "stopping"
  | "stopped"
  | "error";

export interface AgentInstance {
  id: string;
  specialistId: string;
  organizationId: string;
  runner: AgentRunnerId;
  gatewayPort: number;
  gatewayHost: string;
  status: AgentInstanceStatus;
  lastActivity: string;
  pid?: number;
}

export interface AgentGatewayMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AgentGatewayRequest {
  message: string;
  history?: AgentGatewayMessage[];
  images?: string[];
}

export type AgentGatewayResponseType = "final" | "question";

export interface AgentGatewayResponse {
  type: AgentGatewayResponseType;
  answer?: string;
  question?: string;
  steps?: string[];
  images?: string[];
  toolExecutions?: Array<{
    tool: string;
    arguments: Record<string, unknown>;
    result: unknown;
  }>;
}

export interface AgentGatewayUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCost: number;
  model: string;
}

/** Parsed SSE event from a runner adapter. */
export interface AgentGatewayEvent {
  event: string;
  data: Record<string, unknown>;
}

export type AgentChatStateStatus = "idle" | "processing" | "completed" | "error";

export interface AgentChatStateSnapshot {
  chatId: string;
  status: AgentChatStateStatus;
  startedAt: string;
  endedAt?: string | null;
  eventCount: number;
  events: Array<{ event: string; data: unknown }>;
  result?: Record<string, unknown> | null;
  error?: string | null;
}

/**
 * Required HTTP routes for every runner adapter process:
 *
 * - GET  /health
 * - POST /v1/chat          (SSE stream, ends with `event: done`)
 * - GET  /v1/chat/state    (?since=N for recovery)
 * - POST /v1/query         (optional — SQL passthrough for data specialists)
 *
 * At spawn, the instance manager writes `.dude-runner-session.json` (see
 * RunnerSessionManifest). Adapters load it on startup; all tool/dispatch calls
 * must use manifest.internalApi — never ad-hoc curl, ports, or DB paths.
 */
export const AGENT_RUNNER_HTTP_ROUTES = {
  health: "/health",
  chat: "/v1/chat",
  chatState: "/v1/chat/state",
  query: "/v1/query",
} as const;

/**
 * Maximum wall-clock time for a single agent chat turn across the UI↔runner bridge.
 * Used for SSE read-idle abort (API gateway-client) and client session polling.
 * Tool arg generation (e.g. large HTML) can be silent for 10+ minutes on the wire.
 */
export const AGENT_CHAT_TURN_TIMEOUT_MS = 20 * 60 * 1000;
