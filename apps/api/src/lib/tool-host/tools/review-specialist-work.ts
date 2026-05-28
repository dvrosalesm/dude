/**
 * review_specialist_work — inspect a specialist workspace: recent chat with
 * the internal agent plus artifact summaries from workspace collections.
 */

import { Type } from "@sinclair/typebox";
import { internalPost } from "@dude/sdk/gateway-runtime";
import { config } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "../types.js";
import { isApiError, toolError, toolText } from "./_shared.js";

export function createReviewSpecialistWorkTool(): ToolDefinition {
  return {
    name: "review_specialist_work",
    label: "Review Specialist Work",
    description:
      "Review what a specialist agent has produced in a workspace — recent " +
      "messages from delegations and summaries of saved artifacts/collections. " +
      "Use when the user asks to review, audit, or check an agent's output before " +
      "giving follow-up instructions or propagating work downstream.",
    parameters: Type.Object({
      workspaceId: Type.String({
        description:
          "Specialist workspace id from gtSession or list_project_workspaces.",
      }),
      specialistId: Type.Optional(
        Type.String({
          description:
            "Optional specialist id for clearer reporting (e.g. data-analyst).",
        }),
      ),
    }),
    execute: async (_toolCallId, params) => {
      const workspaceId = String(params?.workspaceId || "").trim();
      if (!workspaceId) return toolError("workspaceId is required");

      const gtWorkspaceId = config.workspaceId;
      if (!gtWorkspaceId) {
        return toolError("Missing GT workspace id for review_specialist_work");
      }

      const hub = await internalPost("/assistant/project-hub", {
        gtWorkspaceId,
      });

      if (isApiError(hub)) {
        return toolError(hub.error);
      }

      const agents = Array.isArray((hub as { agents?: unknown }).agents)
        ? ((hub as { agents: Array<Record<string, unknown>> }).agents ?? [])
        : [];

      const match =
        agents.find((agent) => agent.workspaceId === workspaceId) ??
        (params?.specialistId
          ? agents.find(
              (agent) => agent.specialistId === String(params.specialistId),
            )
          : null);

      if (!match) {
        return toolText({
          workspaceId,
          found: false,
          message:
            "This workspace is not linked in the current gtSession project. " +
            "Link it by delegating to the specialist first, or verify the workspace id.",
          allAgents: agents.map((agent) => ({
            specialistId: agent.specialistId,
            workspaceId: agent.workspaceId,
            workspaceName: agent.workspaceName,
          })),
        });
      }

      return toolText({
        found: true,
        review: match,
        instruction:
          "Summarize what this specialist has done, what artifacts exist, gaps or risks, " +
          "and concrete next steps. Offer to send follow-up instructions via the specialist tool.",
      });
    },
  };
}
