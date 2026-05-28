/**
 * Shared adapter chat handler — all non-Pi runners load subagent tools from
 * the central Tool Host (same catalog Pi registers in-process).
 */

import type { ChatHandler } from "./adapter-http.js";
import { runHostedAgentLoop } from "./hosted-agent-loop.js";
import { toolHostConfigFromEnv } from "./tool-host-client.js";

export function createToolHostChatHandler(runnerId: string): ChatHandler {
  return async ({ message, history, images, sendEvent }) => {
    const result = await runHostedAgentLoop({
      message,
      history,
      images,
      systemPrompt: process.env.SYSTEM_PROMPT,
      sendEvent,
      config: {
        ...toolHostConfigFromEnv(),
        runner: runnerId,
      },
    });

    return {
      type: "final",
      answer: result.answer,
      steps: result.steps,
      usage: result.usage,
    };
  };
}
