/**
 * create-subagent-workspace tool — creates a new workspace for a
 * subagent. The main assistant calls this when the user wants a fresh
 * workspace before delegating a task.
 */

import { Type } from "@sinclair/typebox";
import { internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "../types.js";
import { getOrgUser, toolError, toolText } from "./_shared.js";

export function createCreateWorkspaceTool(): ToolDefinition {
  return {
    name: "create-subagent-workspace",
    label: "Create Subagent Workspace",
    description:
      "Create a new workspace for a subagent in this organization. " +
      "Use this when the user wants a new workspace instead of an existing one.",
    parameters: Type.Object({
      subagentId: Type.String({
        description:
          'The subagent ID (e.g. "data-analyst", "design-branding").',
      }),
      name: Type.String({
        description:
          "A short descriptive name for the workspace (e.g. \"Q4 Sales Analysis\").",
      }),
    }),
    execute: async (_toolCallId, params) => {
      const subagentId = String(params?.subagentId || "");
      const name = String(params?.name || "");
      if (!subagentId || !name) {
        return toolError("subagentId and name are required");
      }

      const { orgId, userId } = getOrgUser();
      return toolText(
        await internalPost("/assistant/subagent-workspaces", {
          subagentId,
          orgId,
          name,
          userId,
        }),
      );
    },
  };
}
