import {
  canonicalAgentKind,
  MAIN_ASSISTANT_KIND,
  parseAgentInstanceId,
} from "@dude/sdk/runner";

/**
 * Map client route ids (e.g. presentation-editor) to gateway specialist ids
 * (e.g. document-editor) used by the tool registry and dispatch API.
 */
export function resolveGatewaySpecialistId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  return canonicalAgentKind(trimmed);
}

/**
 * Tool-host and internal workspace APIs use the scope workspace id
 * (e.g. ws-presentation-editor-…), not the full instance key
 * (document-editor:ws-presentation-editor-…).
 */
export function resolveToolHostWorkspaceId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const parsed = parseAgentInstanceId(trimmed);
  if (parsed && parsed.agentKind !== MAIN_ASSISTANT_KIND) {
    return parsed.scopeId;
  }

  return trimmed;
}
