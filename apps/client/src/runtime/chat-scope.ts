import type { SpecialistId } from "../types";

/**
 * Local thread / pending-turn scope.
 * Main assistant home chat uses `"default"` when no workspace is selected.
 */
export function resolveChatScopeId(
  specialistId: SpecialistId,
  workspaceId?: string,
): string {
  const trimmed = workspaceId?.trim();
  if (trimmed) return trimmed;
  if (specialistId === "main-assistant") return "default";
  throw new Error("Workspace id is required for specialist chat");
}

/**
 * Gateway instance + session scope.
 * Main assistant home omits scope so the gateway falls back to `GATEWAY_USER_ID`.
 */
export function resolveGatewayScopeId(
  specialistId: SpecialistId,
  workspaceId?: string,
): string | undefined {
  const trimmed = workspaceId?.trim();
  if (!trimmed || (specialistId === "main-assistant" && trimmed === "default")) {
    return specialistId === "main-assistant" ? undefined : trimmed;
  }
  return trimmed;
}

/** Optional scope for UI-provided workspace ids (undefined → main-assistant default). */
export function normalizeChatScopeId(
  specialistId: SpecialistId,
  workspaceId?: string,
): string | undefined {
  const trimmed = workspaceId?.trim();
  if (trimmed) return trimmed;
  if (specialistId === "main-assistant") return "default";
  return undefined;
}
