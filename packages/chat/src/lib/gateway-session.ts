import type { SpecialistId } from "@dude/client-types";
import {
  MAIN_ASSISTANT_KIND,
  buildMainAssistantInstanceId,
  buildSpecialistInstanceId,
  canonicalAgentKind,
} from "@dude/sdk/runner";

export const GATEWAY_SESSION_PREFIX = "dude.gateway-session.v1";
export const GATEWAY_USER_ID = "local-user";

function gatewaySpecialistId(specialistId: SpecialistId) {
  return canonicalAgentKind(specialistId);
}

function gatewayWorkspaceId(
  specialistId: SpecialistId,
  workspaceId?: string,
) {
  const kind = gatewaySpecialistId(specialistId);
  const scopeId = workspaceId ?? GATEWAY_USER_ID;

  if (kind === MAIN_ASSISTANT_KIND) {
    return buildMainAssistantInstanceId(scopeId);
  }

  return buildSpecialistInstanceId(kind, scopeId);
}

export function gatewaySessionKey(
  specialistId: SpecialistId,
  workspaceId?: string,
) {
  return `${GATEWAY_SESSION_PREFIX}:${gatewayWorkspaceId(specialistId, workspaceId)}`;
}

export function readGatewaySessionId(
  specialistId: SpecialistId,
  workspaceId?: string,
) {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(gatewaySessionKey(specialistId, workspaceId)) || undefined;
}

export function writeGatewaySessionId(
  specialistId: SpecialistId,
  sessionId: string,
  workspaceId?: string,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(gatewaySessionKey(specialistId, workspaceId), sessionId);
}

export function clearGatewaySessionId(
  specialistId: SpecialistId,
  workspaceId?: string,
) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(gatewaySessionKey(specialistId, workspaceId));
}
