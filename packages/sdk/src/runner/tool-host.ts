/**
 * Tool Host — standard API for runner adapters to discover and execute tools.
 *
 * Runners connect to the main Dude API (localhost) — not to each other.
 * Tool implementations live in the host; runners only receive schemas and
 * invoke execution over HTTP.
 */

import type { AgentRunnerId } from "./types.js";

/** JSON Schema object describing tool parameters (OpenAI / Anthropic compatible). */
export type AgentToolParametersSchema = Record<string, unknown>;

export interface AgentToolCatalogEntry {
  name: string;
  label: string;
  description: string;
  parameters: AgentToolParametersSchema;
}

export interface AgentToolHostSession {
  workspaceId: string;
  subagentId: string;
  organizationId: string;
  runner: AgentRunnerId;
}

export interface AgentToolHostCatalogResponse {
  session: AgentToolHostSession;
  tools: AgentToolCatalogEntry[];
  collections: string[];
  skillPaths: string[];
}

export interface AgentToolHostExecuteRequest {
  tool: string;
  toolCallId: string;
  arguments: Record<string, unknown>;
}

export interface AgentToolHostExecuteResponse {
  content: Array<{ type: string; text: string }>;
  details: Record<string, unknown>;
}

/** Unified dispatch API — routes by action name to subagent handlers. */
export interface AgentDispatchRequest {
  action: string;
  payload?: Record<string, unknown>;
  callId?: string;
}

/**
 * Tool Host HTTP routes on the main API (localhost-only).
 *
 * Runners call these with session headers:
 *   x-workspace-id, x-subagent-id, x-organization-id, x-runner-id
 */
export const AGENT_TOOL_HOST_ROUTES = {
  catalog: "/v1/internal/tool-host/catalog",
  execute: "/v1/internal/tool-host/execute",
} as const;

/** Unified subagent action router — one endpoint, routes by action name. */
export const AGENT_DISPATCH_ROUTES = {
  catalog: "/v1/internal/agent/catalog",
  dispatch: "/v1/internal/agent/dispatch",
} as const;

export const AGENT_TOOL_HOST_HEADERS = {
  workspaceId: "x-workspace-id",
  subagentId: "x-subagent-id",
  organizationId: "x-organization-id",
  runnerId: "x-runner-id",
} as const;
