/**
 * finish_turn — explicit signal that the agent is done and the final answer is ready.
 */

import { Type } from "@sinclair/typebox";
import { recordTurnFinish } from "../../turn-control.js";
import type { ToolDefinition } from "../types.js";
import { toolError, toolText } from "./_shared.js";

export function createFinishTurnTool(): ToolDefinition {
  return {
    name: "finish_turn",
    label: "Finish turn",
    description:
      "End the current turn and deliver the final answer to the user. Call this once " +
      "when all work is done — after tools, image generation, delegation, etc. Use " +
      "`send_progress` for interim updates; put the complete result in `answer`. " +
      "Do not stop after skill-selection narration or partial plans — finish the work, " +
      "then call this tool.",
    parameters: Type.Object({
      answer: Type.String({
        description:
          "Final user-facing markdown reply: what was done, artifacts/paths, optional next step.",
      }),
      suggestions: Type.Optional(
        Type.Array(Type.String(), {
          description: "Optional quick-reply chips for the user (max 4).",
        }),
      ),
    }),
    execute: async (_toolCallId, params) => {
      const answer = String(params?.answer || "").trim();
      if (!answer) return toolError("answer is required");

      const suggestions = Array.isArray(params?.suggestions)
        ? params.suggestions
            .map((entry: unknown) => String(entry || "").trim())
            .filter(Boolean)
            .slice(0, 4)
        : undefined;

      const payload = { answer, suggestions };
      recordTurnFinish(payload);
      return toolText({ finished: true, ...payload });
    },
  };
}
