import type { SubagentId } from "../types";

/**
 * Local thread / pending-turn scope.
 * Main assistant home chat uses `"default"` when no workspace is selected.
 */
export function resolveChatScopeId(
  subagentId: SubagentId,
  workspaceId?: string,
): string {
  const trimmed = workspaceId?.trim();
  if (trimmed) return trimmed;
  if (subagentId === "main-assistant") return "default";
  throw new Error("Workspace id is required for subagent chat");
}

/**
 * Gateway instance + session scope.
 * Main assistant home omits scope so the gateway falls back to `GATEWAY_USER_ID`.
 */
export function resolveGatewayScopeId(
  subagentId: SubagentId,
  workspaceId?: string,
): string | undefined {
  const trimmed = workspaceId?.trim();
  if (!trimmed || (subagentId === "main-assistant" && trimmed === "default")) {
    return subagentId === "main-assistant" ? undefined : trimmed;
  }
  return trimmed;
}

/** Optional scope for UI-provided workspace ids (undefined → main-assistant default). */
export function normalizeChatScopeId(
  subagentId: SubagentId,
  workspaceId?: string,
): string | undefined {
  const trimmed = workspaceId?.trim();
  if (trimmed) return trimmed;
  if (subagentId === "main-assistant") return "default";
  return undefined;
}
