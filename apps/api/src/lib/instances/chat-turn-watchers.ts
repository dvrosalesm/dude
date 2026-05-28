import { AGENT_CHAT_TURN_TIMEOUT_MS } from "@dude/sdk/runner";
import type { UiInputRequestPublic } from "../ui-input-types.js";
import type { ConversationMessage } from "./conversation-message.js";
import { enrichSessionMessages, type ChatSession } from "./session-store.js";

export type TurnProgressPayload = {
  pendingUserInput?: UiInputRequestPublic | null;
  executionTraces?: Array<{
    id: string;
    timestamp: string;
    steps: string[];
    toolExecutions: Array<{
      tool: string;
      arguments: Record<string, unknown>;
      result: unknown;
    }>;
    durationMs: number;
  }>;
  partialAssistantContent?: string;
  progressMessages?: string[];
};

export type TurnDonePayload = {
  status: "completed" | "error";
  messages: ConversationMessage[];
  error?: string;
};

type TurnWatcher = (progress: TurnProgressPayload) => void;
type TurnDoneWatcher = (done: TurnDonePayload) => void;

const progressWatchers = new Map<string, Set<TurnWatcher>>();
const doneWatchers = new Map<string, Set<TurnDoneWatcher>>();
const latestProgress = new Map<string, TurnProgressPayload>();
const latestDone = new Map<string, TurnDonePayload>();

export function turnWatchKey(
  workspaceId: string,
  sessionId: string,
  messageId: string,
): string {
  return `${workspaceId}:${sessionId}:${messageId}`;
}

export function buildTurnProgressPayload(
  assistantMsg: ConversationMessage,
  pendingUserInput?: UiInputRequestPublic | null,
): TurnProgressPayload {
  const traces = assistantMsg.traces;
  return {
    pendingUserInput: pendingUserInput ?? assistantMsg.pendingUserInput ?? null,
    executionTraces: traces
      ? [
          {
            id: assistantMsg.id,
            timestamp: assistantMsg.createdAt,
            steps: traces.steps ?? [],
            toolExecutions: traces.toolExecutions ?? [],
            durationMs: traces.durationMs ?? 0,
          },
        ]
      : [],
    partialAssistantContent: assistantMsg.content?.trim()
      ? assistantMsg.content
      : undefined,
    progressMessages: assistantMsg.progressMessages ?? [],
  };
}

export function publishTurnProgress(
  key: string,
  progress: TurnProgressPayload,
): void {
  latestProgress.set(key, progress);
  for (const watcher of progressWatchers.get(key) ?? []) {
    watcher(progress);
  }
}

export function publishTurnDone(key: string, done: TurnDonePayload): void {
  latestDone.set(key, done);
  for (const watcher of doneWatchers.get(key) ?? []) {
    watcher(done);
  }
  progressWatchers.delete(key);
  doneWatchers.delete(key);
  latestProgress.delete(key);
}

export function subscribeTurnProgress(
  key: string,
  watcher: TurnWatcher,
): () => void {
  let set = progressWatchers.get(key);
  if (!set) {
    set = new Set();
    progressWatchers.set(key, set);
  }
  set.add(watcher);
  const cached = latestProgress.get(key);
  if (cached) watcher(cached);
  return () => {
    set?.delete(watcher);
    if (set && set.size === 0) progressWatchers.delete(key);
  };
}

export function subscribeTurnDone(
  key: string,
  watcher: TurnDoneWatcher,
): () => void {
  let set = doneWatchers.get(key);
  if (!set) {
    set = new Set();
    doneWatchers.set(key, set);
  }
  set.add(watcher);
  const cached = latestDone.get(key);
  if (cached) watcher(cached);
  return () => {
    set?.delete(watcher);
    if (set && set.size === 0) doneWatchers.delete(key);
  };
}

export function waitForTurnDone(
  key: string,
  timeoutMs = AGENT_CHAT_TURN_TIMEOUT_MS,
): Promise<TurnDonePayload> {
  const cached = latestDone.get(key);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error("Chat turn timed out"));
    }, timeoutMs);

    const unsubscribe = subscribeTurnDone(key, (done) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(done);
    });
  });
}

export function buildTurnDonePayload(
  session: ChatSession,
  assistantMsg: ConversationMessage,
): TurnDonePayload {
  return {
    status: assistantMsg.status === "error" ? "error" : "completed",
    messages: enrichSessionMessages(session),
    error: assistantMsg.error,
  };
}

export function encodeChatTurnSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function createChatTurnSseStream(input: {
  key: string;
  initialProgress?: TurnProgressPayload;
  initialDone?: TurnDonePayload;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let keepAlive: ReturnType<typeof setInterval> | null = null;
      let unsubscribeProgress = () => {};
      let unsubscribeDone = () => {};

      const close = () => {
        if (closed) return;
        closed = true;
        if (keepAlive) clearInterval(keepAlive);
        unsubscribeProgress();
        unsubscribeDone();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const write = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(encodeChatTurnSse(event, data)));
      };

      if (input.initialDone) {
        write("done", input.initialDone);
        close();
        return;
      }

      if (input.initialProgress) {
        write("progress", input.initialProgress);
      }

      keepAlive = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(": ka\n\n"));
      }, 15_000);

      unsubscribeProgress = subscribeTurnProgress(input.key, (progress) => {
        write("progress", progress);
      });

      unsubscribeDone = subscribeTurnDone(input.key, (done) => {
        write("done", done);
        close();
      });

      cleanup = close;
    },
    cancel() {
      cleanup?.();
    },
  });
}
