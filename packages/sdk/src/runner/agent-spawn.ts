/**
 * Agent spawn model — one background runner per agent identity.
 *
 * - **Dude (main assistant)**: one pi/codex/hermes process per user thread
 * - **Specialist**: one process per subagent kind + workspace
 *
 * Instance id format: `{agentKind}:{scopeId}`
 *
 * Legacy hosted ids `{organizationId}:{agentKind}:{scopeId}` are still parsed.
 */

export const MAIN_ASSISTANT_KIND = "main-assistant" as const;

/** Main assistant or any subagent / custom agent kind id. */
export type AgentKind = typeof MAIN_ASSISTANT_KIND | (string & {});

export interface AgentSpawnIdentity {
  agentKind: AgentKind;
  /**
   * Main assistant → user id (conversation thread).
   * Subagent → workspace id (each workspace gets its own runner).
   */
  scopeId: string;
  /** Present when parsed from a legacy hosted instance id. */
  legacyOrganizationId?: string;
}

/** Stable key for the instance manager — one runner child process per id. */
export function buildAgentInstanceId(identity: AgentSpawnIdentity): string {
  return `${identity.agentKind}:${identity.scopeId}`;
}

export function parseAgentInstanceId(
  instanceId: string,
): AgentSpawnIdentity | null {
  const firstIdx = instanceId.indexOf(":");
  if (firstIdx === -1) return null;

  const rest = instanceId.slice(firstIdx + 1);
  const secondIdx = rest.indexOf(":");

  // Legacy: `{organizationId}:{agentKind}:{scopeId}`
  if (secondIdx !== -1) {
    const organizationId = instanceId.slice(0, firstIdx);
    const agentKind = rest.slice(0, secondIdx);
    const scopeId = rest.slice(secondIdx + 1);
    if (!organizationId || !agentKind || !scopeId) return null;
    return {
      agentKind,
      scopeId,
      legacyOrganizationId: organizationId,
    };
  }

  const agentKind = instanceId.slice(0, firstIdx);
  const scopeId = rest;
  if (!agentKind || !scopeId) return null;

  return { agentKind, scopeId };
}

/** Map client route ids to gateway subagent ids (e.g. presentation-editor → document-editor). */
export function canonicalAgentKind(agentKind: string): string {
  if (agentKind === "presentation-editor") return "document-editor";
  return agentKind;
}

export function buildMainAssistantInstanceId(userId: string): string {
  return buildAgentInstanceId({
    agentKind: MAIN_ASSISTANT_KIND,
    scopeId: userId,
  });
}

export function buildSubagentInstanceId(
  specialistKind: string,
  workspaceId: string,
): string {
  return buildAgentInstanceId({
    agentKind: canonicalAgentKind(specialistKind),
    scopeId: workspaceId,
  });
}

export function isMainAssistantKind(agentKind: string): boolean {
  return agentKind === MAIN_ASSISTANT_KIND;
}
