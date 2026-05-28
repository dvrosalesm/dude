/**
 * ui_request_input — the single supported way for agents to ask the user
 * for confirmations, free-text answers, or choices while running in Dude UI.
 */

import { Type } from "@sinclair/typebox";
import { config } from "@dude/sdk/gateway-runtime";
import { internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "../types.js";
import { isApiError, toolError, toolText } from "./_shared.js";

export function createUiRequestInputTool(): ToolDefinition {
  return {
    name: "ui_request_input",
    label: "Ask user in UI",
    description:
      "Request input from the user through the Dude UI. Use this for ALL confirmations, " +
      "approval prompts, clarifying questions, and multiple-choice decisions while running " +
      "inside Dude. Do not ask the user to answer in chat when this tool is available. " +
      "Kinds: confirm (yes/no), question (free text), choice (pick one option). " +
      "Wait for the tool result before continuing.",
    parameters: Type.Object({
      kind: Type.Union([
        Type.Literal("confirm"),
        Type.Literal("question"),
        Type.Literal("choice"),
      ], {
        description: "confirm = yes/no approval; question = free text; choice = pick one option.",
      }),
      title: Type.String({
        description: "Short headline shown in the UI card.",
      }),
      message: Type.String({
        description: "Body copy explaining what you need from the user.",
      }),
      options: Type.Optional(
        Type.Array(
          Type.Object({
            id: Type.String({ description: "Stable option id returned in the tool result." }),
            label: Type.String({ description: "User-facing option label." }),
          }),
          { description: "Required for kind=choice (at least two options)." },
        ),
      ),
      default_option_id: Type.Optional(
        Type.String({ description: "Pre-selected option id for kind=choice." }),
      ),
      placeholder: Type.Optional(
        Type.String({ description: "Input placeholder for kind=question." }),
      ),
    }),
    execute: async (toolCallId, params) => {
      const workspaceId = config.workspaceId;
      if (!workspaceId) {
        return toolError("Missing workspace id for ui_request_input");
      }

      const kind = params?.kind;
      if (kind !== "confirm" && kind !== "question" && kind !== "choice") {
        return toolError('kind must be "confirm", "question", or "choice"');
      }

      const title = String(params?.title || "").trim();
      const message = String(params?.message || "").trim();
      if (!title || !message) {
        return toolError("title and message are required");
      }

      const options = Array.isArray(params?.options)
        ? params.options
            .map((entry: { id?: string; label?: string }) => ({
              id: String(entry?.id || "").trim(),
              label: String(entry?.label || "").trim(),
            }))
            .filter((entry: { id: string; label: string }) => entry.id && entry.label)
        : undefined;

      if (kind === "choice" && (!options || options.length < 2)) {
        return toolError("choice requests require at least two options");
      }

      const result = await internalPost(
        `/workspace/${encodeURIComponent(workspaceId)}/ui-input/wait`,
        {
          kind,
          title,
          message,
          options,
          defaultOptionId: params?.default_option_id,
          placeholder: params?.placeholder,
          toolCallId,
          source: "ui_request_input",
        },
      );

      if (isApiError(result)) {
        return toolError(result.error);
      }

      return toolText(result);
    },
  };
}
