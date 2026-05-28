import type { SubagentId } from "@dude/client-types";
import {
  MAIN_ASSISTANT_KIND,
  buildMainAssistantInstanceId,
  buildSubagentInstanceId,
  canonicalAgentKind,
} from "@dude/sdk/runner";

export const GATEWAY_SESSION_PREFIX = "dude.gateway-session.v1";
export const GATEWAY_USER_ID = "local-user";

function gatewaySubagentId(subagentId: SubagentId) {
  return canonicalAgentKind(subagentId);
}

function gatewayWorkspaceId(
  subagentId: SubagentId,
  workspaceId?: string,
) {
  const kind = gatewaySubagentId(subagentId);
  const scopeId = workspaceId ?? GATEWAY_USER_ID;

  if (kind === MAIN_ASSISTANT_KIND) {
    return buildMainAssistantInstanceId(scopeId);
  }

  return buildSubagentInstanceId(kind, scopeId);
}

export function gatewaySessionKey(
  subagentId: SubagentId,
  workspaceId?: string,
) {
  return `${GATEWAY_SESSION_PREFIX}:${gatewayWorkspaceId(subagentId, workspaceId)}`;
}

export function readGatewaySessionId(
  subagentId: SubagentId,
  workspaceId?: string,
) {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(gatewaySessionKey(subagentId, workspaceId)) || undefined;
}

export function writeGatewaySessionId(
  subagentId: SubagentId,
  sessionId: string,
  workspaceId?: string,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(gatewaySessionKey(subagentId, workspaceId), sessionId);
}

export function clearGatewaySessionId(
  subagentId: SubagentId,
  workspaceId?: string,
) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(gatewaySessionKey(subagentId, workspaceId));
}
