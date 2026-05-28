/**
 * list-subagent-workspaces tool — returns existing workspaces for a
 * subagent within the current organization. The main assistant calls
 * this before delegating so it can ask the user which workspace to use.
 *
 * The result includes pre-formatted suggestions the LLM should present
 * as clickable buttons so the user can pick without typing.
 */

import { Type } from "@sinclair/typebox";
import { internalGet } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "../types.js";
import { getOrgUser, toolError, toolText } from "./_shared.js";

export function createListWorkspacesTool(): ToolDefinition {
  return {
    name: "list-subagent-workspaces",
    label: "List Subagent Workspaces",
    description:
      "List existing workspaces for a subagent. You MUST call this before any subagent tool. " +
      "After receiving the result, STOP and present the workspace options to the user as suggestions. " +
      "Wait for the user to choose before proceeding. Never skip this step.",
    parameters: Type.Object({
      subagentId: Type.String({
        description:
          'The subagent ID to list workspaces for (e.g. "data-analyst", "design-branding").',
      }),
    }),
    execute: async (_toolCallId, params) => {
      const subagentId = String(params?.subagentId || "");
      if (!subagentId) return toolError("subagentId is required");

      const { orgId } = getOrgUser();
      const result = (await internalGet(
        `/assistant/subagent-workspaces?subagentId=${encodeURIComponent(subagentId)}&orgId=${encodeURIComponent(orgId)}`,
      )) as { workspaces?: Array<{ id: string; name: string; date?: string }> };

      const workspaces = result.workspaces || [];

      // Build suggestions for the LLM to include in its response
      const suggestions = workspaces.flatMap((ws) => [
        `action:open-subagent:${subagentId}:${ws.id}:Open ${ws.name}`,
        `action:instruct-agent:${subagentId}:${ws.id}:Instruct ${ws.name}`,
        `action:review-agent:${subagentId}:${ws.id}:Review ${ws.name}`,
        `Use: ${ws.name}`,
      ]);
      suggestions.push("Create new workspace");

      return toolText({
        workspaces,
        suggestions,
        instruction:
          "Present these workspaces to the user and include the suggestions array as clickable buttons. " +
          "WAIT for the user's choice. Do NOT proceed until they respond.",
      });
    },
  };
}
