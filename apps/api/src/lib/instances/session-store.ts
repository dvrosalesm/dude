import { randomUUID } from "node:crypto";
import { getPendingUiInput } from "../ui-input-store.js";
import type {
  CompactionInfo,
  ConversationMessage,
} from "./conversation-message.js";
import {
  deleteChatSessionsForWorkspace,
  loadChatSession,
  listChatSessionsForWorkspace,
  saveChatSession,
} from "./turn-store.js";

export interface ChatSession {
  sessionId: string;
  workspaceId: string;
  messages: ConversationMessage[];
  createdAt: string;
  compaction?: CompactionInfo;
}

const sessions = new Map<string, ChatSession>();

function sessionKey(workspaceId: string, sessionId: string): string {
  return `${workspaceId}:${sessionId}`;
}

function cacheSession(session: ChatSession): ChatSession {
  sessions.set(sessionKey(session.workspaceId, session.sessionId), session);
  return session;
}

export function persistChatSession(session: ChatSession): void {
  cacheSession(session);
  saveChatSession(session);
}

export function getOrCreateSession(
  workspaceId: string,
  sessionId?: string,
): ChatSession {
  const id = sessionId || randomUUID();
  const key = sessionKey(workspaceId, id);

  const cached = sessions.get(key);
  if (cached) return cached;

  const persisted = loadChatSession(workspaceId, id);
  if (persisted) {
    return cacheSession(persisted);
  }

  const session: ChatSession = {
    sessionId: id,
    workspaceId,
    messages: [],
    createdAt: new Date().toISOString(),
  };
  persistChatSession(session);
  return session;
}

export function getSession(
  workspaceId: string,
  sessionId: string,
): ChatSession | undefined {
  const key = sessionKey(workspaceId, sessionId);
  const cached = sessions.get(key);
  if (cached) return cached;

  const persisted = loadChatSession(workspaceId, sessionId);
  if (!persisted) return undefined;
  return cacheSession(persisted);
}

export function listSessionsForWorkspace(workspaceId: string): ChatSession[] {
  const persisted = listChatSessionsForWorkspace(workspaceId);
  for (const session of persisted) {
    cacheSession(session);
  }
  return persisted;
}

export function deleteSessionsForWorkspace(workspaceId: string): void {
  for (const key of sessions.keys()) {
    if (key.startsWith(`${workspaceId}:`)) {
      sessions.delete(key);
    }
  }
  deleteChatSessionsForWorkspace(workspaceId);
}

export function enrichSessionMessages(
  session: ChatSession,
): ConversationMessage[] {
  const pending = getPendingUiInput(session.workspaceId);
  return session.messages.map((message) => {
    if (message.status !== "processing" || !pending) return message;
    return { ...message, pendingUserInput: pending };
  });
}

export function appendChatTurnMessages(
  session: ChatSession,
  userMsg: ConversationMessage,
  assistantMsg: ConversationMessage,
): void {
  session.messages.push(userMsg, assistantMsg);
  persistChatSession(session);
}

export function updateSessionCompaction(
  session: ChatSession,
  compaction: CompactionInfo,
): void {
  session.compaction = compaction;
  persistChatSession(session);
}

export function clearSessionMemoryCacheForTests(): void {
  sessions.clear();
}
