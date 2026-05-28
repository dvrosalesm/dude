/**
 * Cursor SDK (@cursor/sdk) agent loop — local Agent.create + streaming runs.
 */

import { Agent, CursorAgentError, type SDKAgent, type SDKMessage } from "@cursor/sdk";
import type { GatewayMessage } from "./adapter-http.js";
import { requireRunnerSessionManifest } from "./codex-dynamic-tools.js";
import { appendNativeRunnerToolsToPrompt } from "./native-runner-tool-bridge.js";

export interface CursorAgentLoopInput {
  message: string;
  history?: GatewayMessage[];
  images?: string[];
  sendEvent?: (event: string, data: unknown) => void;
}

export interface CursorAgentLoopResult {
  answer: string;
  steps: string[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    total_cost: number;
  };
}

let sessionAgent: SDKAgent | null = null;
let sessionHistoryInjected = false;

function resolveCursorModel(): { id: string } {
  const explicit = process.env.CURSOR_MODEL?.trim();
  if (explicit) return { id: explicit };

  const fromConfig = process.env.MODEL_ID?.trim();
  // OpenRouter-style ids (provider/model) are not valid Cursor model ids.
  if (fromConfig && !fromConfig.includes("/")) {
    return { id: fromConfig };
  }

  return { id: "composer-2.5" };
}

function buildPrompt(message: string, history?: GatewayMessage[]): string {
  const systemPrompt = process.env.SYSTEM_PROMPT?.trim() || "";
  const systemBlock = systemPrompt
    ? `<system_instructions>\n${systemPrompt}\n</system_instructions>\n\n`
    : "";

  if (!sessionHistoryInjected && history && history.length > 0) {
    sessionHistoryInjected = true;
    const historyText = history
      .map((row) => `${row.role}: ${row.content}`)
      .join("\n\n");
    return (
      `${systemBlock}<conversation_history>\n` +
      "The following is the previous conversation. Continue naturally.\n\n" +
      `${historyText}\n</conversation_history>\n\n` +
      `User's new message: ${message}`
    );
  }

  if (!sessionHistoryInjected) {
    sessionHistoryInjected = true;
    return `${systemBlock}${message}`;
  }

  return message;
}

async function buildPromptWithTools(
  message: string,
  history?: GatewayMessage[],
): Promise<string> {
  const base = buildPrompt(message, history);
  requireRunnerSessionManifest();
  return appendNativeRunnerToolsToPrompt(base);
}

async function ensureAgent(): Promise<SDKAgent> {
  if (sessionAgent) return sessionAgent;

  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "CURSOR_API_KEY is required for the cursor-sdk runner. " +
        "Create a key at https://cursor.com/dashboard/integrations",
    );
  }

  sessionAgent = await Agent.create({
    apiKey,
    model: resolveCursorModel(),
    local: {
      cwd: process.cwd(),
      settingSources: [],
    },
  });

  return sessionAgent;
}

function mapSdkMessage(
  message: SDKMessage,
  sendEvent: (event: string, data: unknown) => void,
  state: { thinkingStarted: boolean },
) {
  switch (message.type) {
    case "thinking": {
      if (!state.thinkingStarted) {
        sendEvent("thinking_start", {});
        state.thinkingStarted = true;
      }
      if (message.text) {
        sendEvent("thinking", { delta: message.text });
      }
      break;
    }

    case "tool_call": {
      if (message.status === "running") {
        sendEvent("tool_call_start", { tool: message.name });
        sendEvent("tool_call", {
          tool: message.name,
          arguments: (message.args as Record<string, unknown>) ?? {},
        });
      } else if (message.status === "completed") {
        sendEvent("tool_result", {
          tool: message.name,
          result: message.result,
        });
      } else if (message.status === "error") {
        sendEvent("tool_result", {
          tool: message.name,
          result: message.result ?? "Tool call failed",
        });
      }
      break;
    }

    case "assistant": {
      for (const block of message.message.content) {
        if (block.type === "text" && block.text) {
          sendEvent("text_delta", { delta: block.text });
        } else if (block.type === "tool_use") {
          sendEvent("tool_call_start", { tool: block.name });
          sendEvent("tool_call", {
            tool: block.name,
            arguments: (block.input as Record<string, unknown>) ?? {},
          });
        }
      }
      break;
    }

    case "status": {
      if (
        message.status === "FINISHED" ||
        message.status === "ERROR" ||
        message.status === "CANCELLED"
      ) {
        if (state.thinkingStarted) {
          sendEvent("thinking_end", {});
          state.thinkingStarted = false;
        }
      }
      break;
    }

    default:
      break;
  }
}

export async function runCursorAgentLoop(
  input: CursorAgentLoopInput,
): Promise<CursorAgentLoopResult> {
  const sendEvent = input.sendEvent ?? (() => {});
  const steps: string[] = [];
  const streamState = { thinkingStarted: false };

  const agent = await ensureAgent();
  const prompt = await buildPromptWithTools(input.message, input.history);

  const userMessage =
    input.images && input.images.length > 0
      ? {
          text: prompt,
          images: input.images.map((url) => ({ url })),
        }
      : prompt;

  try {
    const run = await agent.send(userMessage, {
      local: { force: true },
    });

    steps.push(`Cursor run ${run.id}`);

    for await (const event of run.stream()) {
      mapSdkMessage(event, sendEvent, streamState);
    }

    if (streamState.thinkingStarted) {
      sendEvent("thinking_end", {});
      streamState.thinkingStarted = false;
    }

    const result = await run.wait();
    if (result.status === "error") {
      throw new Error(`Cursor agent run failed (${result.id})`);
    }

    const answer = (result.result || "").trim() || "(No response)";
    return {
      answer,
      steps,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        total_cost: 0,
      },
    };
  } catch (error) {
    if (error instanceof CursorAgentError) {
      throw new Error(`Cursor SDK: ${error.message}`);
    }
    throw error;
  }
}

export async function closeCursorAgentSession() {
  if (sessionAgent) {
    sessionAgent.close();
    sessionAgent = null;
  }
  sessionHistoryInjected = false;
}

process.on("SIGTERM", () => {
  void closeCursorAgentSession();
});
process.on("SIGINT", () => {
  void closeCursorAgentSession();
});
