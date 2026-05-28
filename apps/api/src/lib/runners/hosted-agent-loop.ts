/**
 * Generic ReAct loop for runners that use the Tool Host instead of in-process tools.
 * Pi registers the same tool catalog in-process; Codex, Hermes, and Cursor use this loop.
 */

import type { AgentToolHostCatalogResponse } from "@dude/sdk/runner";
import type { GatewayMessage } from "./adapter-http.js";
import {
  buildHostedConversationMessages,
  type HostedChatMessage,
} from "./hosted-agent-loop-helpers.js";
import {
  dispatchAgentRemote,
  fetchToolHostCatalog,
  openAiToolsFromCatalog,
  toolHostConfigFromEnv,
  toolResultText,
  type ToolHostClientConfig,
} from "./tool-host-client.js";
import {
  beginActiveTurn,
  endActiveTurn,
} from "../turn-control.js";

function parseToolResultObject(resultText: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(resultText);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export interface HostedAgentLoopInput {
  message: string;
  history?: GatewayMessage[];
  images?: string[];
  systemPrompt?: string;
  maxIterations?: number;
  sendEvent?: (event: string, data: unknown) => void;
  config?: ToolHostClientConfig;
}

export {
  buildHostedConversationMessages,
  buildHostedSystemPrompt,
  buildHostedUserContent,
  buildSkillPackHint,
} from "./hosted-agent-loop-helpers.js";

type ChatMessage = HostedChatMessage;

export interface HostedAgentLoopResult {
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

async function callOpenRouterChat(opts: {
  model: string;
  apiKey: string;
  messages: ChatMessage[];
  tools: ReturnType<typeof openAiToolsFromCatalog>;
}): Promise<{
  message: ChatMessage;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      tools: opts.tools.length ? opts.tools : undefined,
      tool_choice: opts.tools.length ? "auto" : undefined,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter chat failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    message: data?.choices?.[0]?.message ?? { role: "assistant", content: "" },
    usage: data?.usage,
  };
}

export async function runHostedAgentLoop(
  input: HostedAgentLoopInput,
): Promise<HostedAgentLoopResult> {
  const config = input.config ?? toolHostConfigFromEnv();
  const apiKey = process.env.API_KEY || "";
  const model = process.env.MODEL_ID || "deepseek/deepseek-v4-pro";
  const maxIterations =
    input.maxIterations ??
    parseInt(process.env.MAX_ITERATIONS || "12", 10);

  if (!apiKey) {
    throw new Error(
      "No LLM API key configured. Add your provider key in Settings → API & Models, " +
        "or set OPEN_ROUTER_API_KEY / OPENAI_API_KEY in .env.local for local development.",
    );
  }

  const catalog: AgentToolHostCatalogResponse = await fetchToolHostCatalog(config);
  const openAiTools = openAiToolsFromCatalog(catalog);
  const steps: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  const messages = buildHostedConversationMessages(input, catalog);

  input.sendEvent?.("thinking_start", {});
  steps.push(
    `Loaded ${catalog.tools.length} tools from Tool Host (${config.subagentId})`,
  );

  beginActiveTurn({
    emitProgress: (message) => {
      input.sendEvent?.("progress_message", { message });
    },
    requestAbort: () => {
      /* Hosted loop exits explicitly when finish_turn resolves. */
    },
  });

  try {
  for (let i = 0; i < maxIterations; i += 1) {
    const { message, usage } = await callOpenRouterChat({
      model,
      apiKey,
      messages,
      tools: openAiTools,
    });

    inputTokens += usage?.prompt_tokens ?? 0;
    outputTokens += usage?.completion_tokens ?? 0;

    const toolCalls = message.tool_calls ?? [];
    if (!toolCalls.length) {
      const interim = (message.content || "").trim();
      if (interim) {
        input.sendEvent?.("progress_message", { message: interim });
        steps.push(interim);
        messages.push({
          role: "assistant",
          content: interim,
        });
        messages.push({
          role: "user",
          content:
            "Continue working. Use send_progress for short updates and finish_turn when the task is complete.",
        });
        continue;
      }

      input.sendEvent?.("thinking_end", {});
      return {
        answer: "(No response — call finish_turn when done.)",
        steps,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          total_cost: 0,
        },
      };
    }

    messages.push(message);

    for (const call of toolCalls) {
      const toolName = call.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }

      input.sendEvent?.("toolcall_start", { name: toolName, arguments: args });
      steps.push(`Tool: ${toolName}`);

      let resultText: string;
      try {
        const result = await dispatchAgentRemote(config, {
          action: toolName,
          callId: call.id,
          payload: args,
        });
        resultText = toolResultText(result);
        input.sendEvent?.("toolcall_end", {
          name: toolName,
          result: resultText.slice(0, 2000),
        });

        const parsed = parseToolResultObject(resultText);
        if (parsed?.finished === true && typeof parsed.answer === "string") {
          input.sendEvent?.("thinking_end", {});
          return {
            answer: parsed.answer.trim(),
            steps,
            usage: {
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              cache_read_tokens: 0,
              cache_write_tokens: 0,
              total_cost: 0,
            },
          };
        }
      } catch (error) {
        resultText =
          error instanceof Error ? error.message : String(error);
        input.sendEvent?.("toolcall_end", {
          name: toolName,
          error: resultText,
        });
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: toolName,
        content: resultText,
      });
    }
  }

  input.sendEvent?.("thinking_end", {});
  return {
    answer: "Reached maximum tool iterations without finish_turn.",
    steps,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      total_cost: 0,
    },
  };
  } finally {
    endActiveTurn();
  }
}
