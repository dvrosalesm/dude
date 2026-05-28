/**
 * Cursor SDK runner adapter — native Agent.create loop + Dude dispatch API for subagent actions.
 */

import { startAdapterServer } from "../../lib/runners/adapter-http.js";
import { runCursorAgentLoop } from "../../lib/runners/cursor-agent-loop.js";

const port = parseInt(process.env.GATEWAY_PORT || "8080", 10);
const modelLabel =
  process.env.CURSOR_MODEL?.trim() ||
  (process.env.MODEL_ID?.includes("/") ? "composer-2.5" : process.env.MODEL_ID) ||
  "composer-2.5";

startAdapterServer({
  runnerId: "cursor",
  port,
  modelLabel,
  async onChat({ message, history, images, sendEvent }) {
    const result = await runCursorAgentLoop({
      message,
      history,
      images,
      sendEvent,
    });

    return {
      type: "final",
      answer: result.answer,
      steps: result.steps,
      usage: result.usage,
    };
  },
});
