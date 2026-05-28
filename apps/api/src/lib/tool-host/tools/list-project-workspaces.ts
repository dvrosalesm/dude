/**
 * list_project_workspaces — returns all specialist workspaces linked in
 * the active GT project session (gtSession), enriched with recent activity.
 */

import { Type } from "@sinclair/typebox";
import { config } from "@dude/sdk/gateway-runtime";
import { internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "../types.js";
import { isApiError, toolError, toolText } from "./_shared.js";

export function createListProjectWorkspacesTool(): ToolDefinition {
  return {
    name: "list_project_workspaces",
    label: "List Project Workspaces",
    description:
      "List every specialist workspace linked to the current GT project session. " +
      "Use this when the user asks what workspaces are active, wants to manage " +
      "the project, review specialist output, or send follow-up instructions to " +
      "an internal agent. Returns agent cards with recent messages and artifact summaries.",
    parameters: Type.Object({}),
    execute: async () => {
      const gtWorkspaceId = config.workspaceId;
      if (!gtWorkspaceId) {
        return toolError("Missing GT workspace id for list_project_workspaces");
      }

      const result = await internalPost("/assistant/project-hub", {
        gtWorkspaceId,
      });

      if (isApiError(result)) {
        return toolError(result.error);
      }

      const hub = result as {
        agents?: Array<{ specialistId: string; workspaceName: string }>;
        suggestions?: string[];
      };

      return toolText({
        ...result,
        instruction:
          hub.agents?.length
            ? "Summarize the active project workspaces for the user. " +
              "Include the suggestions array as clickable action buttons when present. " +
              "To instruct or review an agent, call the specialist tool or review_specialist_work."
            : "No specialist workspaces are linked yet. Ask which specialist the user wants, " +
              "then call list-specialist-workspaces and create or pick a workspace before delegating.",
      });
    },
  };
}
