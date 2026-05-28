import type { SubagentId } from "@dude/client-types";

export function subagentListPath(subagentId: SubagentId | string) {
  return `/chat/subagents/${subagentId}`;
}

export function subagentWorkspacePath(
  subagentId: SubagentId | string,
  workspaceId: string,
) {
  return `/chat/subagents/${subagentId}/${workspaceId}`;
}
