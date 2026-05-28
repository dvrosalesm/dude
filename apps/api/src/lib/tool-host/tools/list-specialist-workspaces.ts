/**
 * list-specialist-workspaces tool — returns existing workspaces for a
 * specialist within the current organization. The main assistant calls
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
    name: "list-specialist-workspaces",
    label: "List Specialist Workspaces",
    description:
      "List existing workspaces for a specialist. You MUST call this before any specialist tool. " +
      "After receiving the result, STOP and present the workspace options to the user as suggestions. " +
      "Wait for the user to choose before proceeding. Never skip this step.",
    parameters: Type.Object({
      specialistId: Type.String({
        description:
          'The specialist ID to list workspaces for (e.g. "data-analyst", "design-branding").',
      }),
    }),
    execute: async (_toolCallId, params) => {
      const specialistId = String(params?.specialistId || "");
      if (!specialistId) return toolError("specialistId is required");

      const { orgId } = getOrgUser();
      const result = (await internalGet(
        `/assistant/specialist-workspaces?specialistId=${encodeURIComponent(specialistId)}&orgId=${encodeURIComponent(orgId)}`,
      )) as { workspaces?: Array<{ id: string; name: string; date?: string }> };

      const workspaces = result.workspaces || [];

      // Build suggestions for the LLM to include in its response
      const suggestions = workspaces.flatMap((ws) => [
        `action:open-specialist:${specialistId}:${ws.id}:Open ${ws.name}`,
        `action:instruct-agent:${specialistId}:${ws.id}:Instruct ${ws.name}`,
        `action:review-agent:${specialistId}:${ws.id}:Review ${ws.name}`,
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
