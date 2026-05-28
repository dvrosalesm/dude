"use client";

import type { LocalChatMessage, SubagentId } from "../types";
import type { SendLocalMessageInput } from "@dude/client-types";
import type { GatewayConversationMessage } from "./gateway-types";
import {
  appendMessagePair,
  appendUserMessageToThread,
  gatewayWorkspaceId,
} from "./gateway-desktop";
import { mapGatewayMessage, streamGatewayChatTurn } from "./gateway-chat";
import { readGatewaySessionId } from "@dude/chat/lib/gateway-session";
import { gatewayRequest } from "./gateway-desktop";
import { extractUserFacingMessage } from "@dude/gateway-shared/user-facing-message";
import { getThread, readState, threadKey, writeState } from "./local-chat-storage";
import {
  normalizeChatScopeId,
  resolveGatewayScopeId,
} from "./chat-scope";
import { canUseGateway } from "./gateway-desktop";

export type PendingGatewayTurn = {
  subagentId: SubagentId;
  workspaceId: string;
  gtWorkspaceId: string;
  sessionId: string;
  assistantMessageId: string;
};

export type GatewayTurnProgress = {
  pendingUserInput?: unknown;
  executionTraces?: unknown[];
  progressMessages?: string[];
};

type TurnListener = (update: GatewayTurnProgress) => void;

function turnKey(subagentId: SubagentId, workspaceId?: string): string {
  return threadKey(subagentId, workspaceId);
}

function pendingStorageKey(key: string): string {
  return `dude:gateway-pending-turn:${key}`;
}

const inflightTurns = new Map<string, Promise<void>>();
const turnListeners = new Map<string, Set<TurnListener>>();

function readPendingTurn(key: string): PendingGatewayTurn | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(pendingStorageKey(key));
    if (!raw) return null;
    return JSON.parse(raw) as PendingGatewayTurn;
  } catch {
    return null;
  }
}

function writePendingTurn(turn: PendingGatewayTurn): void {
  if (typeof sessionStorage === "undefined") return;
  const key = turnKey(turn.subagentId, turn.workspaceId);
  sessionStorage.setItem(pendingStorageKey(key), JSON.stringify(turn));
}

function clearPendingTurn(key: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(pendingStorageKey(key));
}

export function subscribeGatewayTurn(
  subagentId: SubagentId,
  workspaceId: string | undefined,
  listener: TurnListener,
): () => void {
  const key = turnKey(subagentId, workspaceId);
  const set = turnListeners.get(key) ?? new Set();
  set.add(listener);
  turnListeners.set(key, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) turnListeners.delete(key);
  };
}

function notifyTurnListeners(
  key: string,
  update: GatewayTurnProgress,
): void {
  const set = turnListeners.get(key);
  if (!set) return;
  for (const listener of set) {
    listener(update);
  }
}

export function getInflightGatewayTurn(
  subagentId: SubagentId,
  workspaceId?: string,
): Promise<void> | undefined {
  return inflightTurns.get(turnKey(subagentId, workspaceId));
}

export function abandonGatewayTurn(
  subagentId: SubagentId,
  workspaceId?: string,
): void {
  const key = turnKey(subagentId, workspaceId);
  inflightTurns.delete(key);
  clearPendingTurn(key);
}

const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_WAIT_MS = 10 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait for the gateway session to leave processing without opening a new SSE stream. */
async function pollUntilGatewayTurnSettles(
  subagentId: SubagentId,
  workspaceId: string | undefined,
  sessionId: string,
): Promise<void> {
  const deadline = Date.now() + POLL_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const messages = await fetchGatewaySessionMessages(
      subagentId,
      workspaceId,
      sessionId,
    );
    if (!gatewaySessionHasActiveTurn(messages)) {
      await syncGatewayMessagesToLocalThread(subagentId, workspaceId);
      return;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  await syncGatewayMessagesToLocalThread(subagentId, workspaceId);
  const stillActive = gatewaySessionHasActiveTurn(
    await fetchGatewaySessionMessages(subagentId, workspaceId, sessionId),
  );
  if (stillActive) {
    throw new Error("Timed out waiting for the agent to finish");
  }
}

export async function fetchGatewaySessionMessages(
  subagentId: SubagentId,
  workspaceId: string | undefined,
  sessionId: string,
): Promise<GatewayConversationMessage[]> {
  const gatewayScope = resolveGatewayScopeId(subagentId, workspaceId);
  const gtWorkspaceId = gatewayWorkspaceId(subagentId, gatewayScope);
  const data = await gatewayRequest<{
    sessionId: string;
    messages: GatewayConversationMessage[];
  }>(
    `/instances/${encodeURIComponent(gtWorkspaceId)}/chat?sessionId=${encodeURIComponent(sessionId)}`,
    { method: "GET", timeoutMs: 30_000 },
  );
  return data.messages ?? [];
}

export function gatewaySessionHasActiveTurn(
  messages: GatewayConversationMessage[],
): boolean {
  return messages.some(
    (message) => message.role === "assistant" && message.status === "processing",
  );
}

export function resolveActiveAssistantMessageId(
  messages: GatewayConversationMessage[],
): string | undefined {
  return [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === "assistant" && message.status === "processing",
    )?.id;
}

export async function syncGatewayMessagesToLocalThread(
  subagentId: SubagentId,
  workspaceId?: string,
): Promise<{ messages: LocalChatMessage[]; active: boolean }> {
  const chatScope = normalizeChatScopeId(subagentId, workspaceId);
  const state = await readState();
  if (!chatScope) {
    return {
      messages: getThread(state, subagentId, workspaceId),
      active: false,
    };
  }

  const localMessages = getThread(state, subagentId, chatScope);

  if (!canUseGateway()) {
    return { messages: localMessages, active: false };
  }

  const gatewayScope = resolveGatewayScopeId(subagentId, chatScope);
  const sessionId = readGatewaySessionId(subagentId, gatewayScope);
  if (!sessionId) {
    return { messages: localMessages, active: false };
  }

  try {
    const gatewayMessages = await fetchGatewaySessionMessages(
      subagentId,
      chatScope,
      sessionId,
    );
    const active = gatewaySessionHasActiveTurn(gatewayMessages);
    const persisted = gatewayMessages
      .filter(
        (message) =>
          message.role === "user" ||
          (message.role === "assistant" && message.status !== "processing"),
      )
      .map((message) => mapGatewayMessage(message, subagentId));

    state.threads[threadKey(subagentId, chatScope)] = persisted;
    await writeState(state);
    return {
      messages: persisted,
      active,
    };
  } catch {
    return {
      messages: localMessages,
      active: Boolean(getInflightGatewayTurn(subagentId, chatScope)),
    };
  }
}

export async function appendGatewayUserMessage(
  input: SendLocalMessageInput,
  gatewayUser: GatewayConversationMessage,
  displayContent?: string,
): Promise<LocalChatMessage> {
  const userFacing =
    displayContent?.trim() ||
    extractUserFacingMessage(gatewayUser.content);
  const mapped = mapGatewayMessage(gatewayUser, input.subagentId);
  return appendUserMessageToThread(input, {
    ...mapped,
    content: userFacing,
    displayContent: userFacing,
    images: input.images,
    files: input.files,
  });
}

export async function completeGatewayTurn(
  turn: PendingGatewayTurn,
  input: SendLocalMessageInput,
  options?: {
    onProgress?: SendLocalMessageInput["onProgress"];
    displayContent?: string;
  },
): Promise<void> {
  const key = turnKey(turn.subagentId, turn.workspaceId);

  const notify = (update: GatewayTurnProgress) => {
    options?.onProgress?.(update as Parameters<
      NonNullable<SendLocalMessageInput["onProgress"]>
    >[0]);
    notifyTurnListeners(key, update);
  };

  const completedMessages = await streamGatewayChatTurn(
    turn.gtWorkspaceId,
    turn.sessionId,
    turn.assistantMessageId,
    turn.subagentId,
    notify,
  );

  const userMessage = [...completedMessages]
    .reverse()
    .find((message) => message.role === "user");
  const assistantMessage = [...completedMessages]
    .reverse()
    .find((message) => message.role === "assistant");

  if (!userMessage || !assistantMessage) {
    throw new Error("Gateway returned an incomplete chat turn");
  }

  const mappedUser = mapGatewayMessage(userMessage, turn.subagentId);
  const mappedAssistant = mapGatewayMessage(
    assistantMessage,
    turn.subagentId,
  );
  const userFacingContent =
    options?.displayContent?.trim() ||
    extractUserFacingMessage(mappedUser.content);

  await appendMessagePair(
    input,
    {
      ...mappedUser,
      content: userFacingContent,
      displayContent: userFacingContent,
      images: input.images,
      files: input.files,
    },
    mappedAssistant,
  );
}

export function startGatewayTurnCompletion(
  turn: PendingGatewayTurn,
  input: SendLocalMessageInput,
  options?: {
    onProgress?: SendLocalMessageInput["onProgress"];
    displayContent?: string;
  },
): Promise<void> {
  const key = turnKey(turn.subagentId, turn.workspaceId);
  const existing = inflightTurns.get(key);
  if (existing) return existing;

  writePendingTurn(turn);

  const promise = completeGatewayTurn(turn, input, options)
    .catch((error) => {
      console.warn("[gateway] turn completion failed:", error);
      throw error;
    })
    .finally(() => {
      if (inflightTurns.get(key) === promise) {
        inflightTurns.delete(key);
      }
      clearPendingTurn(key);
    });

  inflightTurns.set(key, promise);
  return promise;
}

export async function resumeGatewayTurnIfNeeded(
  subagentId: SubagentId,
  workspaceId?: string,
): Promise<{
  active: boolean;
  promise?: Promise<void>;
  reattaching?: boolean;
}> {
  const key = turnKey(subagentId, workspaceId);
  const inflight = inflightTurns.get(key);
  if (inflight) {
    return { active: true, promise: inflight, reattaching: true };
  }

  const gatewayScope = resolveGatewayScopeId(
    subagentId,
    normalizeChatScopeId(subagentId, workspaceId),
  );
  const sessionId = readGatewaySessionId(subagentId, gatewayScope);
  if (!sessionId) {
    return { active: false };
  }

  let messages: GatewayConversationMessage[];
  try {
    messages = await fetchGatewaySessionMessages(
      subagentId,
      normalizeChatScopeId(subagentId, workspaceId),
      sessionId,
    );
  } catch {
    clearPendingTurn(key);
    return { active: false };
  }

  if (!gatewaySessionHasActiveTurn(messages)) {
    clearPendingTurn(key);
    await syncGatewayMessagesToLocalThread(subagentId, workspaceId);
    return { active: false };
  }

  const gtWorkspaceId = gatewayWorkspaceId(subagentId, gatewayScope);
  try {
    const instance = await gatewayRequest<{ status?: string }>(
      `/instances/${encodeURIComponent(gtWorkspaceId)}`,
      { method: "GET", timeoutMs: 10_000 },
    );
    if (instance.status !== "running") {
      clearPendingTurn(key);
      await syncGatewayMessagesToLocalThread(subagentId, workspaceId);
      return { active: false };
    }
  } catch {
    clearPendingTurn(key);
    await syncGatewayMessagesToLocalThread(subagentId, workspaceId);
    return { active: false };
  }

  const promise = pollUntilGatewayTurnSettles(
    subagentId,
    workspaceId,
    sessionId,
  )
    .catch((error) => {
      console.warn("[gateway] poll resume failed:", error);
      throw error;
    })
    .finally(() => {
      inflightTurns.delete(key);
      clearPendingTurn(key);
    });

  inflightTurns.set(key, promise);
  return { active: true, promise, reattaching: false };
}
