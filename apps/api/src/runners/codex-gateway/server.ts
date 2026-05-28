/**
 * Codex runner adapter — native Codex app-server loop + Dude dispatch API for subagent actions.
 */

import { startAdapterServer } from "../../lib/runners/adapter-http.js";
import { runCodexAgentLoop } from "../../lib/runners/codex-agent-loop.js";

const port = parseInt(process.env.GATEWAY_PORT || "8080", 10);

function logGatewayProcessErrors(runnerId: string) {
  process.on("uncaughtException", (error) => {
    console.error(`[${runnerId}-gateway] uncaughtException:`, error);
  });
  process.on("unhandledRejection", (reason) => {
    console.error(`[${runnerId}-gateway] unhandledRejection:`, reason);
  });
}

logGatewayProcessErrors("codex");

startAdapterServer({
  runnerId: "codex",
  port,
  modelLabel: process.env.MODEL_ID || "codex",
  async onChat({ message, history, sendEvent }) {
    const result = await runCodexAgentLoop({
      message,
      history,
      sendEvent,
    });

    return {
      type: "final",
      answer: result.answer,
      images: result.images.length > 0 ? result.images : undefined,
      suggestions: result.suggestions,
      steps: result.steps,
      usage: result.usage,
    };
  },
});
