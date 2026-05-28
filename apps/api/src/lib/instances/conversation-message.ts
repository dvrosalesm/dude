import type { GatewayEvent, GatewayResponse, GatewayUsage } from "../types.js";
import { applyTraceEvent, type TraceState } from "../trace-formatter.js";
import type { UiInputRequestPublic } from "../ui-input-types.js";

export interface ToolExecution {
  tool: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  response?: GatewayResponse;
  usage?: GatewayUsage;
  suggestions?: string[];
  traces?: {
    steps: string[];
    toolExecutions: ToolExecution[];
    durationMs: number;
  };
  progressMessages?: string[];
  pendingUserInput?: UiInputRequestPublic | null;
  status: "completed" | "processing" | "error";
  error?: string;
  createdAt: string;
}

export interface CompactionInfo {
  summary: string;
  firstKeptEntryId?: string;
  tokensBefore?: number;
  compactedAt: string;
}

const traceStates = new WeakMap<ConversationMessage, TraceState>();

function getTraceState(msg: ConversationMessage): TraceState | null {
  if (!msg.traces) return null;
  let state = traceStates.get(msg);
  if (!state) {
    state = {
      steps: msg.traces.steps,
      toolExecutions: msg.traces.toolExecutions,
      thinkingBuffer: "",
    };
    traceStates.set(msg, state);
  }
  return state;
}

export function applyGatewayEventToMessage(
  msg: ConversationMessage,
  evt: GatewayEvent,
): void {
  if (!msg.traces) return;
  const state = getTraceState(msg);
  if (!state) return;

  applyTraceEvent(state, evt);

  if (evt.event === "text_delta") {
    const delta = evt.data.delta;
    if (typeof delta === "string" && delta) {
      msg.content += delta;
    }
  }

  switch (evt.event) {
    case "progress_message": {
      // progressMessages is the dedicated field the client streams for status-line UI.
      const text = String(evt.data.message || "").trim();
      if (!text) break;
      if (!msg.progressMessages) msg.progressMessages = [];
      msg.progressMessages.push(text);
      break;
    }
    case "done":
      if (Array.isArray(evt.data.suggestions)) {
        msg.suggestions = evt.data.suggestions as string[];
      }
      if (Array.isArray(evt.data.images)) {
        const urls = (evt.data.images as unknown[])
          .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
        if (urls.length > 0) {
          msg.images = urls;
        }
      }
      break;
    case "error":
      console.error("[Gateway] Agent error event:", evt.data);
      break;
  }

  msg.traces.durationMs = Date.now() - new Date(msg.createdAt).getTime();
}

export function finalizeAssistantMessage(
  msg: ConversationMessage,
  input: {
    answer?: string;
    question?: string;
    images?: string[];
    response: GatewayResponse;
    usage: GatewayUsage;
  },
): void {
  msg.status = "completed";
  msg.content = input.answer || input.question || "";
  msg.images = input.images;
  msg.response = input.response;
  msg.usage = input.usage;
  msg.pendingUserInput = null;
  if (msg.traces) {
    msg.traces.durationMs = Date.now() - new Date(msg.createdAt).getTime();
  }
}

export function failAssistantMessage(msg: ConversationMessage, error: string): void {
  msg.status = "error";
  msg.error = error;
  msg.pendingUserInput = null;
}
