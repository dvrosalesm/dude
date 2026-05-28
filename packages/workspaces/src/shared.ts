import type {
  LocalChatMessage,
  LocalSpecialistWorkspace,
  SpecialistId,
} from "@dude/client-types";

import { extractUserFacingMessage } from "@dude/gateway-shared/user-facing-message";
import { LocalWorkspaceApiError } from "./errors";
import { chatRuntime } from "./runtime-binding";

export { chatRuntime };

/** Known specialist route paths — kept free of `specialists.config.client` to avoid import cycles. */
const SPECIALIST_PATHS = new Set<string>([
  "data-analyst",
  "presentation-editor",
  "document-writer",
  "prospect",
  "design-branding",
]);

export type WorkspaceRecord = LocalSpecialistWorkspace;

export type UiMessage = {
  id: string;
  role: LocalChatMessage["role"];
  message: string;
  content: string;
  date: string;
  images?: string[];
  files?: LocalChatMessage["files"];
};

export function toUiMessage(message: LocalChatMessage): UiMessage {
  const content =
    message.role === "user"
      ? message.displayContent?.trim() ||
        extractUserFacingMessage(message.content)
      : message.content;
  return {
    id: message.id,
    role: message.role,
    message: content,
    content,
    date: message.createdAt,
    images: message.images,
    files: message.files,
  };
}

export function specialistFromPath(value: string | undefined): SpecialistId | null {
  if (value && SPECIALIST_PATHS.has(value)) return value as SpecialistId;
  return null;
}

export async function requireWorkspace(workspaceId: string) {
  const workspace = await chatRuntime.getWorkspace(workspaceId);
  if (!workspace) {
    throw new LocalWorkspaceApiError("Workspace not found", 404);
  }
  return workspace;
}

export async function requireMatchingWorkspace(
  specialistId: SpecialistId,
  workspaceId: string,
) {
  const workspace = await requireWorkspace(workspaceId);
  if (workspace.specialistId !== specialistId) {
    throw new LocalWorkspaceApiError("Workspace specialist mismatch", 403);
  }
  return workspace;
}

export async function patchWorkspaceConfig(
  workspace: LocalSpecialistWorkspace,
  updates: Record<string, unknown>,
) {
  const next = await chatRuntime.updateWorkspace(workspace.id, {
    status: "active",
    configurations: updates,
  });
  return next ?? workspace;
}
