/**
 * send_progress — stream a user-visible status update while work continues.
 */

import { Type } from "@sinclair/typebox";
import { recordProgressMessage } from "../../turn-control.js";
import type { ToolDefinition } from "../types.js";
import { toolError, toolText } from "./_shared.js";

export function createSendProgressTool(): ToolDefinition {
  return {
    name: "send_progress",
    label: "Send progress update",
    description:
      "Post a short, user-visible status update while you keep working. Use this to " +
      "tell the user what you are doing now (e.g. 'Generating the bear image…', " +
      "'Searching the web for pricing…'). Do not use this for the final answer — call " +
      "`finish_turn` when the task is complete. You may call this multiple times per turn.",
    parameters: Type.Object({
      message: Type.String({
        description:
          "Plain-language update for the user. One or two sentences max. No markdown fences.",
      }),
    }),
    execute: async (_toolCallId, params) => {
      const message = String(params?.message || "").trim();
      if (!message) return toolError("message is required");

      recordProgressMessage(message);
      return toolText({ ok: true, message });
    },
  };
}
