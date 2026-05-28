/**
 * AgentsGT Gateway — Core types.
 *
 * Defines the contract between the main AgentsGT app and the gateway
 * for spawning and managing isolated agent instances.
 *
 * Runner protocol types live in @dude/sdk/runner — re-exported here for
 * backward compatibility.
 */

export type {
  AgentGatewayEvent as GatewayEvent,
  AgentGatewayMessage as GatewayMessage,
  AgentGatewayRequest as GatewayRequest,
  AgentGatewayResponse as GatewayResponse,
  AgentGatewayUsage as GatewayUsage,
  AgentHarnessConfig,
  AgentRunnerId,
} from "@dude/sdk/runner";

export { DEFAULT_AGENT_RUNNER_ID } from "@dude/sdk/runner";

import type {
  AgentGatewayResponse,
  AgentGatewayUsage,
  AgentGatewayMessage,
  AgentRunnerId,
} from "@dude/sdk/runner";

// ---------------------------------------------------------------------------
// Instance & lifecycle
// ---------------------------------------------------------------------------

export type InstanceStatus =
  | 'starting'
  | 'provisioning'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface AgentInstance {
  /** Unique instance id — `{org}:{agentKind}:{scopeId}`. */
  id: string;
  /** Agent kind: `main-assistant` or a subagent id (e.g. `data-analyst`). */
  subagentId: string;
  /** Organization that owns the workspace. */
  organizationId: string;
  /** Agent harness adapter (pi, codex, hermes, …). */
  runner: AgentRunnerId;
  /** Port exposed on the host for the gateway. */
  gatewayPort: number;
  /** Hostname for HTTP calls to the gateway. */
  gatewayHost: string;
  /** Current lifecycle status. */
  status: InstanceStatus;
  /** ISO timestamp of last activity (for idle reaping). */
  lastActivity: string;
  /** PID of the child process running this agent. */
  pid?: number;
  /** tmux session name when the agent runs in a detached tmux pane. */
  tmuxSession?: string;
  /** Ready-to-run attach command when `tmuxSession` is set. */
  tmuxAttach?: string;
}

// ---------------------------------------------------------------------------
// Agent configuration (passed by the caller — agent-type agnostic)
// ---------------------------------------------------------------------------

export interface AgentConfig {
  /** Agent harness to run in the background. Defaults to pi. */
  runner?: AgentRunnerId;
  /** LLM provider settings. */
  provider: {
    kind: 'openrouter' | 'openai' | 'openai-codex' | 'groq' | 'ollama';
    model: string;
    endpoint?: string;
    temperature?: number;
    apiKey?: string;
  };
  /** System prompt injected at startup. */
  systemPrompt: string;
  /** Tool definitions available to this instance. */
  tools: AgentToolDef[];
  /** Max iterations in the ReAct loop (used by main-assistant). */
  maxIterations?: number;
  /**
   * Approval mode for side-effect tools (used by main-assistant).
   * auto (default) runs to completion.
   * draft pauses before any outbound side-effect (email, posting).
   * per-step pauses after every tool call.
   */
  approvalMode?: 'auto' | 'draft' | 'per-step';
  /**
   * Subagents exposed as delegation tools (used only by main-assistant).
   * Each entry becomes a tool callable by the main assistant's ReAct loop.
   */
  enabledSpecialists?: Array<{
    id: string;
    label?: string;
    description?: string;
  }>;
  mcpServers?: unknown[];
  sourceTools?: unknown[];
  skills?: unknown[];
  credentials?: import('@dude/sdk/runner').AgentHarnessCredentials;
}

export interface AgentToolDef {
  name: string;
  description: string;
  /** JSON Schema for the tool's parameters. */
  parameters: Record<string, unknown>;
  /**
   * Execution mode:
   * - "local": tool runs inside the agent sandbox (e.g. SQL on local DB)
   * - "http": tool calls an external HTTP endpoint
   */
  mode: 'local' | 'http';
  /** HTTP endpoint (only for mode=http). */
  endpoint?: string;
  /** Local handler identifier (only for mode=local). */
  handler?: string;
}

// ---------------------------------------------------------------------------
// Gateway request / response (for chat with running instances)
// Re-exported from @dude/sdk/runner above as GatewayRequest, GatewayMessage, etc.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Gateway client result
// ---------------------------------------------------------------------------

export interface GatewayResult {
  response: AgentGatewayResponse;
  usage: AgentGatewayUsage;
  rawContent: string;
}

// ---------------------------------------------------------------------------
// API DTOs (for the HTTP layer)
// ---------------------------------------------------------------------------

export interface SpawnInstanceDto {
  workspaceId: string;
  subagentId: string;
  config: AgentConfig;
  /** Client workspace snapshot so agent tools can read/write the same SQLite row as the UI. */
  workspaceSnapshot?: {
    id: string;
    subagentId: string;
    name?: string;
    status?: "draft" | "active";
    configurations?: Record<string, unknown>;
  };
}

export interface ChatMessageDto {
  message: string;
  /** User-visible chat text when `message` includes hidden workspace context. */
  displayMessage?: string;
  /** Session ID for the conversation. If omitted, a new session is created. */
  sessionId?: string;
  history?: AgentGatewayMessage[];
  images?: string[];
}

export interface QueryDto {
  query: string;
}
