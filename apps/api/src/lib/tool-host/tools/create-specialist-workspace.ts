/**
 * create-specialist-workspace tool — creates a new workspace for a
 * specialist. The main assistant calls this when the user wants a fresh
 * workspace before delegating a task.
 */

import { Type } from "@sinclair/typebox";
import { internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "../types.js";
import { getOrgUser, toolError, toolText } from "./_shared.js";

export function createCreateWorkspaceTool(): ToolDefinition {
  return {
    name: "create-specialist-workspace",
    label: "Create Specialist Workspace",
    description:
      "Create a new workspace for a specialist in this organization. " +
      "Use this when the user wants a new workspace instead of an existing one.",
    parameters: Type.Object({
      specialistId: Type.String({
        description:
          'The specialist ID (e.g. "data-analyst", "design-branding").',
      }),
      name: Type.String({
        description:
          "A short descriptive name for the workspace (e.g. \"Q4 Sales Analysis\").",
      }),
    }),
    execute: async (_toolCallId, params) => {
      const specialistId = String(params?.specialistId || "");
      const name = String(params?.name || "");
      if (!specialistId || !name) {
        return toolError("specialistId and name are required");
      }

      const { orgId, userId } = getOrgUser();
      return toolText(
        await internalPost("/assistant/specialist-workspaces", {
          specialistId,
          orgId,
          name,
          userId,
        }),
      );
    },
  };
}
