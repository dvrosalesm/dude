/**
 * Codex CLI agent loop — bridges Dude's HTTP adapter to `codex app-server`.
 * Auth comes from the user's existing Codex CLI login (ChatGPT or API key in ~/.codex).
 */

import { randomUUID } from "node:crypto";
import type { GatewayMessage } from "./adapter-http.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import {
  CodexAppServer,
  closeSharedCodexAppServer,
  getSharedCodexAppServer,
  getSharedCodexThreadId,
  setActiveCodexDynamicToolTracer,
  setSharedCodexThreadId,
} from "./codex-app-server.js";
import {
  buildCodexDynamicToolsPromptAppendix,
  loadCodexDynamicToolCatalog,
  requireRunnerSessionManifest,
} from "./codex-dynamic-tools.js";
import {
  appendAgentMessageDelta,
  createCodexStreamAnswerState,
  emitUserProgress,
  extractDynamicToolArguments,
  extractFinishTurnFromToolOutput,
  extractSendProgressFromDynamicToolItem,
  extractSendProgressFromToolOutput,
  isAgentDispatchShellCommand,
  parseDispatchActionFromCommand,
  recordCompletedAgentMessage,
  recordCompletedToolSummary,
  recordImageGenerationItem,
  resolveCodexAnswer,
  resolveCodexImages,
  type CodexGeneratedImage,
  type CodexStreamAnswerState,
} from "./codex-message-utils.js";
import {
  logCodexEvent,
  logCodexRunFinish,
  logCodexRunStart,
} from "./codex-run-logger.js";

export interface CodexAgentLoopInput {
  message: string;
  history?: GatewayMessage[];
  sendEvent?: (event: string, data: unknown) => void;
}

export interface CodexAgentLoopResult {
  answer: string;
  images: string[];
  steps: string[];
  suggestions?: string[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    total_cost: number;
  };
}

const DISPATCH_SHELL_DELTA =
  /\/bin\/zsh\s+-lc|"curl\s+.*agent\/dispatch|v1\/internal\/agent\/dispatch|dude-dispatch-cli\.ts/i;

const CODEX_TURN_HEARTBEAT_MS = 15_000;
const SILENT_TRACE_TOOLS = new Set(["send_progress", "finish_turn"]);

function shouldEmitToolTrace(tool: string): boolean {
  return !SILENT_TRACE_TOOLS.has(tool);
}

/** Tracks whether conversation history was injected into the shared Codex thread. */
let historyInjected = false;

/** One in-flight Codex loop per gateway process — shared app-server is not re-entrant. */
let codexLoopChain: Promise<void> = Promise.resolve();
let activeCodexLoopId: string | null = null;

function formatCodexEmptyReply(state: CodexStreamAnswerState): string {
  const progress = state.progressMessages
    .map((message) => message.trim())
    .filter(Boolean);
  if (progress.length > 0) {
    return progress.join("\n\n");
  }

  return (
    "Codex finished without a written reply. If it ran commands or tools, " +
    "check the activity trace above."
  );
}

async function withCodexLoopLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = codexLoopChain;
  let release = () => {};
  codexLoopChain = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

function friendlyDispatchToolName(command: string): string | null {
  return parseDispatchActionFromCommand(command);
}

function shouldStreamAgentDelta(delta: string): boolean {
  return !DISPATCH_SHELL_DELTA.test(delta);
}

function resolveCodexModel(): string | undefined {
  const modelId = process.env.MODEL_ID?.trim();
  if (!modelId || modelId.includes("/")) return undefined;
  return modelId;
}

function buildPrompt(message: string, history?: GatewayMessage[]): string {
  const systemPrompt = process.env.SYSTEM_PROMPT?.trim() || "";
  const systemBlock = systemPrompt
    ? `<system_instructions>\n${systemPrompt}\n</system_instructions>\n\n`
    : "";

  if (!historyInjected && history && history.length > 0) {
    historyInjected = true;
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

  if (!historyInjected) {
    historyInjected = true;
    return `${systemBlock}${message}`;
  }

  return message;
}

async function buildPromptWithTools(
  message: string,
  history?: GatewayMessage[],
): Promise<string> {
  const base = buildPrompt(message, history);
  const manifest = requireRunnerSessionManifest();
  const catalog = await loadCodexDynamicToolCatalog(manifest);
  return `${base}${buildCodexDynamicToolsPromptAppendix(catalog)}`;
}

function resolveSavedImagePath(savedPath: string): string {
  if (savedPath.startsWith("~/")) {
    return join(homedir(), savedPath.slice(2));
  }
  if (isAbsolute(savedPath)) return savedPath;
  return join(process.cwd(), savedPath);
}

function hydrateImageDataUrl(image: CodexGeneratedImage): string {
  if (image.dataUrl.startsWith("data:")) return image.dataUrl;
  if (!image.savedPath) return "";

  try {
    const absolutePath = resolveSavedImagePath(image.savedPath);
    const bytes = readFileSync(absolutePath);
    const base64 = bytes.toString("base64");
    const mime =
      absolutePath.endsWith(".jpg") || absolutePath.endsWith(".jpeg")
        ? "image/jpeg"
        : absolutePath.endsWith(".webp")
          ? "image/webp"
          : absolutePath.endsWith(".gif")
            ? "image/gif"
            : "image/png";
    return `data:${mime};base64,${base64}`;
  } catch (error) {
    console.error("[codex-agent-loop] Failed to read generated image:", error);
    return "";
  }
}

function handleImageGenerationItem(
  item: Record<string, unknown>,
  sendEvent: (event: string, data: unknown) => void,
  state: {
    answer: CodexStreamAnswerState;
    steps: string[];
  },
) {
  const recorded = recordImageGenerationItem(state.answer, item);
  if (!recorded) return;

  const dataUrl = hydrateImageDataUrl(recorded);
  if (dataUrl && !recorded.dataUrl.startsWith("data:")) {
    recorded.dataUrl = dataUrl;
  }

  const prompt = recorded.prompt?.trim();
  sendEvent("toolcall_start", { name: "image_gen" });
  sendEvent("toolcall_end", {
    name: "image_gen",
    result: prompt || "Image generated",
  });
  state.steps.push(
    prompt ? `Generated image: ${prompt.slice(0, 120)}` : "Generated image",
  );
}

function mapCodexEvent(
  method: string,
  params: unknown,
  sendEvent: (event: string, data: unknown) => void,
  state: {
    thinkingStarted: boolean;
    answer: CodexStreamAnswerState;
    steps: string[];
    activeTurnId: string | null;
  },
) {
  switch (method) {
    case "turn/started": {
      const turn = (params as { turn?: { id?: string } })?.turn;
      state.activeTurnId = turn?.id ?? null;
      if (!state.thinkingStarted) {
        sendEvent("thinking_start", {});
        state.thinkingStarted = true;
      }
      break;
    }

    case "item/agentMessage/delta": {
      appendAgentMessageDelta(state.answer, params);
      const record =
        params && typeof params === "object"
          ? (params as Record<string, unknown>)
          : {};
      const delta =
        typeof record.delta === "string"
          ? record.delta
          : typeof record.text === "string"
            ? record.text
            : "";
      if (delta && shouldStreamAgentDelta(delta)) {
        sendEvent("text_delta", { delta });
      }
      break;
    }

    case "item/started": {
      const item = (params as { item?: Record<string, unknown> })?.item;
      if (!item || typeof item.type !== "string") break;

      if (item.type === "commandExecution") {
        const command = typeof item.command === "string" ? item.command : "command";
        if (isAgentDispatchShellCommand(command)) {
          const blocked =
            "Blocked shell dispatch — use native dude dynamic tools instead of curl/CLI.";
          sendEvent("progress_message", { message: blocked });
          state.steps.push(blocked);
        }
        const toolName =
          friendlyDispatchToolName(command) ||
          (isAgentDispatchShellCommand(command) ? "specialist_action" : command);
        sendEvent("toolcall_start", { name: toolName });
        sendEvent("toolcall", { name: toolName, arguments: { cwd: item.cwd } });
        state.steps.push(
          isAgentDispatchShellCommand(command)
            ? `Action: ${toolName}`
            : `Command: ${command}`,
        );
      } else if (
        item.type === "dynamicToolCall" ||
        item.type === "mcpToolCall"
      ) {
        const tool =
          typeof item.tool === "string"
            ? item.tool
            : typeof item.name === "string"
              ? item.name
              : "tool";
        const args = extractDynamicToolArguments(item);
        const earlyProgress = extractSendProgressFromDynamicToolItem(item);
        if (earlyProgress) {
          emitUserProgress(earlyProgress, sendEvent, state.answer, state.steps);
        }
        if (shouldEmitToolTrace(tool)) {
          sendEvent("toolcall_start", { name: tool });
          sendEvent("toolcall", { name: tool, arguments: args });
        }
        state.steps.push(`Tool: ${tool}`);
      } else if (item.type === "agentMessage") {
        recordCompletedAgentMessage(state.answer, item);
      } else if (
        item.type === "imageGeneration" ||
        item.type === "image_generation_call"
      ) {
        handleImageGenerationItem(item, sendEvent, state);
      }
      break;
    }

    case "item/completed":
    case "rawResponseItem/completed": {
      const item = (params as { item?: Record<string, unknown> })?.item;
      if (!item || typeof item.type !== "string") break;

      if (item.type === "agentMessage") {
        recordCompletedAgentMessage(state.answer, item);
      } else if (item.type === "commandExecution") {
        const command = typeof item.command === "string" ? item.command : "command";
        const output =
          typeof item.aggregatedOutput === "string"
            ? item.aggregatedOutput.slice(0, 2000)
            : item.status;
        const toolName =
          friendlyDispatchToolName(command) ||
          (isAgentDispatchShellCommand(command) ? "specialist_action" : command);
        const progress =
          typeof output === "string"
            ? extractSendProgressFromToolOutput(output)
            : null;
        if (progress) {
          emitUserProgress(progress, sendEvent, state.answer, state.steps);
        }
        sendEvent("toolcall_end", {
          name: toolName,
          result: isAgentDispatchShellCommand(command)
            ? progress || "Done"
            : output,
        });
        recordCompletedToolSummary(state.answer, item);
      } else if (item.type === "dynamicToolCall") {
        const tool =
          typeof item.tool === "string"
            ? item.tool
            : typeof item.name === "string"
              ? item.name
              : "tool";
        const args = extractDynamicToolArguments(item);
        if (Object.keys(args).length > 0) {
          sendEvent("toolcall", { name: tool, arguments: args });
        }
        const contentItems = Array.isArray(item.contentItems)
          ? item.contentItems
          : [];
        const textParts = contentItems
          .map((entry) => {
            if (!entry || typeof entry !== "object") return "";
            const row = entry as Record<string, unknown>;
            return row.type === "inputText" && typeof row.text === "string"
              ? row.text
              : "";
          })
          .filter(Boolean);
        const output = textParts.join("\n") || item.status;
        const progressFromOutput =
          typeof output === "string"
            ? extractSendProgressFromToolOutput(output)
            : null;
        if (tool === "finish_turn" && typeof output === "string") {
          const finish = extractFinishTurnFromToolOutput(output);
          if (finish) {
            state.answer.dispatchFinish = finish;
          }
        }
        const progress =
          progressFromOutput ||
          (tool === "send_progress"
            ? extractSendProgressFromDynamicToolItem(item)
            : null);
        if (progress) {
          emitUserProgress(progress, sendEvent, state.answer, state.steps);
        }
        if (shouldEmitToolTrace(tool)) {
          sendEvent("toolcall_end", {
            name: tool,
            result:
              typeof output === "string" ? output.slice(0, 2000) : output,
          });
        }
        recordCompletedToolSummary(state.answer, item);
      } else if (item.type === "mcpToolCall") {
        const tool = typeof item.tool === "string" ? item.tool : "tool";
        const args = extractDynamicToolArguments(item);
        if (Object.keys(args).length > 0) {
          sendEvent("toolcall", { name: tool, arguments: args });
        }
        sendEvent("toolcall_end", {
          name: tool,
          result: item.result ?? item.error ?? item.status,
        });
        recordCompletedToolSummary(state.answer, item);
      } else if (
        item.type === "imageGeneration" ||
        item.type === "image_generation_call"
      ) {
        handleImageGenerationItem(item, sendEvent, state);
      }
      break;
    }

    case "turn/completed": {
      const turn = (params as { turn?: { id?: string; status?: string } })?.turn;
      if (state.activeTurnId && turn?.id !== state.activeTurnId) break;
      if (state.thinkingStarted) {
        sendEvent("thinking_end", {});
        state.thinkingStarted = false;
      }
      break;
    }

    default:
      break;
  }
}

async function ensureThread(server: CodexAppServer): Promise<string> {
  const existing = getSharedCodexThreadId();
  if (existing) return existing;

  const model = resolveCodexModel();
  const threadId = await server.startThread({
    ...(model ? { model } : {}),
  });
  setSharedCodexThreadId(threadId);
  return threadId;
}

export async function runCodexAgentLoop(
  input: CodexAgentLoopInput,
): Promise<CodexAgentLoopResult> {
  return withCodexLoopLock(() => runCodexAgentLoopInner(input));
}

async function runCodexAgentLoopInner(
  input: CodexAgentLoopInput,
): Promise<CodexAgentLoopResult> {
  const sendEvent = input.sendEvent ?? (() => {});
  const steps: string[] = [];
  const loopId = randomUUID();
  const state = {
    thinkingStarted: false,
    answer: createCodexStreamAnswerState(),
    steps,
    activeTurnId: null as string | null,
  };

  const server = await getSharedCodexAppServer({
    codexBin: process.env.CODEX_BIN,
    cwd: process.cwd(),
    onEvent: (method, params) => {
      if (activeCodexLoopId !== loopId) return;
      logCodexEvent(method, params);
      mapCodexEvent(method, params, sendEvent, state);
    },
  });

  activeCodexLoopId = loopId;
  setActiveCodexDynamicToolTracer({
    onStart(tool, args) {
      if (activeCodexLoopId !== loopId) return;
      const earlyProgress = extractSendProgressFromDynamicToolItem({
        tool,
        arguments: args,
      });
      if (earlyProgress) {
        emitUserProgress(earlyProgress, sendEvent, state.answer, state.steps);
      }
      if (shouldEmitToolTrace(tool)) {
        sendEvent("toolcall_start", { name: tool });
        sendEvent("toolcall", { name: tool, arguments: args });
      }
      state.steps.push(`Tool: ${tool}`);
    },
    onEnd(tool, args, result) {
      if (activeCodexLoopId !== loopId) return;
      if (shouldEmitToolTrace(tool)) {
        sendEvent("toolcall_end", {
          name: tool,
          result: result.slice(0, 2000),
        });
      }
    },
  });

  try {
    const threadId = await ensureThread(server);
    const prompt = await buildPromptWithTools(input.message, input.history);

    steps.push(`Codex thread ${threadId}`);

    const turnResult = (await server.startTurn(threadId, prompt, {
      ...(resolveCodexModel() ? { model: resolveCodexModel() } : {}),
    })) as { turn?: { id?: string } };

    const turnId = turnResult.turn?.id;
    if (!turnId) {
      throw new Error("Codex app-server did not return a turn id");
    }

    logCodexRunStart({
      message: input.message,
      threadId,
      turnId,
    });

    state.activeTurnId = turnId;
    const heartbeat = setInterval(() => {
      if (activeCodexLoopId !== loopId) return;
      sendEvent("heartbeat", {});
    }, CODEX_TURN_HEARTBEAT_MS);

    let completion: { status: string; error?: string };
    try {
      completion = await server.waitForTurn(turnId);
    } finally {
      clearInterval(heartbeat);
    }

    if (completion.status === "failed") {
      logCodexRunFinish({ answer: "", steps, error: completion.error || "Codex turn failed" });
      throw new Error(completion.error || "Codex turn failed");
    }

    if (state.thinkingStarted) {
      sendEvent("thinking_end", {});
      state.thinkingStarted = false;
    }

    const images = resolveCodexImages(state.answer);
    const answer =
      resolveCodexAnswer(state.answer) || formatCodexEmptyReply(state.answer);

    logCodexRunFinish({ answer, steps });

    return {
      answer,
      images,
      steps,
      suggestions: state.answer.dispatchFinish?.suggestions,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        total_cost: 0,
      },
    };
  } finally {
    setActiveCodexDynamicToolTracer(null);
    if (activeCodexLoopId === loopId) {
      activeCodexLoopId = null;
    }
  }
}

export async function closeCodexAgentSession() {
  historyInjected = false;
  await closeSharedCodexAppServer();
}
