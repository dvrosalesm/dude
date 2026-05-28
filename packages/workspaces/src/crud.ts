import type { SpecialistId } from "@dude/client-types";

import { LocalWorkspaceApiError } from "./errors";
import { hydrateWorkspaceConfigurations } from "./config-hydrator-binding.js";
import {
  chatRuntime,
  requireWorkspace,
  specialistFromPath,
  toUiMessage,
  type WorkspaceRecord,
} from "./shared";

export async function listSpecialistWorkspaces(
  specialistId: SpecialistId,
): Promise<WorkspaceRecord[]> {
  if (!specialistFromPath(specialistId)) {
    throw new LocalWorkspaceApiError("Unknown specialist", 404);
  }
  return chatRuntime.listWorkspaces(specialistId);
}

export async function createSpecialistWorkspace(
  specialistId: SpecialistId,
  input: {
    name?: string;
    configurations?: Record<string, unknown>;
  } = {},
) {
  if (!specialistFromPath(specialistId)) {
    throw new LocalWorkspaceApiError("Unknown specialist", 404);
  }
  return chatRuntime.createWorkspace({
    specialistId,
    name: input.name,
    configurations: input.configurations,
  });
}

export async function getWorkspaceById(workspaceId: string) {
  const workspace = await requireWorkspace(workspaceId);
  const configurations = await hydrateWorkspaceConfigurations(
    workspace.id,
    workspace.configurations ?? {},
  );
  const hydratedWorkspace =
    configurations === workspace.configurations
      ? workspace
      : { ...workspace, configurations };

  const messages = await chatRuntime.listMessages(
    hydratedWorkspace.specialistId,
    hydratedWorkspace.id,
  );
  return {
    workspace: hydratedWorkspace,
    messages: messages.map(toUiMessage),
  };
}

export async function patchWorkspaceById(
  workspaceId: string,
  body: {
    name?: string;
    status?: "draft" | "active";
    configurations?: Record<string, unknown>;
  },
) {
  const workspace = await requireWorkspace(workspaceId);
  const next = await chatRuntime.updateWorkspace(workspace.id, {
    name: typeof body.name === "string" ? body.name : undefined,
    status: body.status === "draft" || body.status === "active" ? body.status : undefined,
    configurations:
      typeof body.configurations === "object" && body.configurations
        ? body.configurations
        : undefined,
  });
  return { workspace: next };
}

export const updateWorkspaceById = patchWorkspaceById;

export async function deleteWorkspaceById(workspaceId: string) {
  const deleted = await chatRuntime.deleteWorkspace(workspaceId);
  return { ok: deleted };
}
