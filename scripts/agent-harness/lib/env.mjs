/** Shared URLs and env for agent / Cursor testing. */

export const CLIENT_URL =
  process.env.DUDE_CLIENT_URL || "http://127.0.0.1:5173";
export const API_URL = process.env.DUDE_API_URL || "http://127.0.0.1:8787";

export const SUBAGENT_IDS = [
  "main-assistant",
  "data-analyst",
  "document-writer",
  "presentation-editor",
  "design-branding",
];

export function subagentWorkspacePath(subagentId, workspaceId) {
  return workspaceId
    ? `/chat/subagents/${subagentId}/${workspaceId}`
    : `/chat/subagents/${subagentId}`;
}

export function clientUrlForPath(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${CLIENT_URL}${normalized}`;
}
