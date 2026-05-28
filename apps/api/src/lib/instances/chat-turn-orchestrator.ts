import { randomUUID } from "node:crypto";
import { extractUserFacingMessage } from "@dude/gateway-shared/user-facing-message";
import {
  pollAgentChatStateUntilDone,
  sendMessage,
} from "../gateway-client.js";
import {
  getInstance,
  setInstanceChatActive,
  touchInstanceById,
} from "../instance-manager.js";
import type {
  AgentInstance,
  ChatMessageDto,
  GatewayEvent,
  GatewayResult,
} from "../types.js";
import {
  cancelUiInputForWorkspace,
  getPendingUiInput,
  setUiInputRequestListener,
} from "../ui-input-store.js";
import { httpError } from "../../routes/http-error.js";
import {
  applyGatewayEventToMessage,
  failAssistantMessage,
  finalizeAssistantMessage,
  type CompactionInfo,
  type ConversationMessage,
} from "./conversation-message.js";
import {
  buildTurnDonePayload,
  buildTurnProgressPayload,
  publishTurnDone,
  publishTurnProgress,
  turnWatchKey,
} from "./chat-turn-watchers.js";
import {
  appendChatTurnMessages,
  enrichSessionMessages,
  getOrCreateSession,
  persistChatSession,
  updateSessionCompaction,
  type ChatSession,
} from "./session-store.js";

function createUserMessage(content: string): ConversationMessage {
  return {
    id: randomUUID(),
    role: "user",
    content,
    status: "completed",
    createdAt: new Date().toISOString(),
  };
}

function createProcessingAssistantMessage(): ConversationMessage {
  return {
    id: randomUUID(),
    role: "assistant",
    content: "",
    status: "processing",
    traces: {
      steps: [],
      toolExecutions: [],
      durationMs: 0,
    },
    createdAt: new Date().toISOString(),
  };
}

function requireRunningInstance(workspaceId: string): AgentInstance {
  const instance = getInstance(workspaceId);
  if (!instance || instance.status !== "running") {
    throw httpError(`No running instance for workspace ${workspaceId}`, 404);
  }
  return instance;
}

function notifyTurnProgress(
  watchKey: string,
  session: ChatSession,
  assistantMsg: ConversationMessage,
) {
  publishTurnProgress(
    watchKey,
    buildTurnProgressPayload(
      assistantMsg,
      getPendingUiInput(session.workspaceId),
    ),
  );
  persistChatSession(session);
}

async function runChatTurnCore(
  workspaceId: string,
  instance: AgentInstance,
  session: ChatSession,
  dto: ChatMessageDto,
  assistantMsg: ConversationMessage,
  watchKey: string,
): Promise<GatewayResult> {
  let eventsConsumed = 0;
  setUiInputRequestListener((inputWorkspaceId, request) => {
    if (inputWorkspaceId !== workspaceId) return;
    if (assistantMsg.status !== "processing") return;
    assistantMsg.pendingUserInput = request;
    notifyTurnProgress(watchKey, session, assistantMsg);
  });

  const onAgentEvent = (evt: GatewayEvent) => {
    touchInstanceById(workspaceId);
    if (evt.event === "compaction" && evt.data?.summary) {
      updateSessionCompaction(session, {
        summary: String(evt.data.summary),
        firstKeptEntryId: evt.data.firstKeptEntryId as string | undefined,
        tokensBefore: evt.data.tokensBefore as number | undefined,
        compactedAt: new Date().toISOString(),
      });
    }
    applyGatewayEventToMessage(assistantMsg, evt);
    eventsConsumed += 1;
    notifyTurnProgress(watchKey, session, assistantMsg);
  };

  try {
    return await sendMessage(
      instance.gatewayHost,
      instance.gatewayPort,
      {
        message: dto.message,
        history: dto.history,
        images: dto.images,
      },
      onAgentEvent,
    );
  } catch (sseError) {
    const sseMsg =
      sseError instanceof Error ? sseError.message : String(sseError);
    console.warn(
      `[Gateway] SSE stream broke for ${workspaceId} after ${eventsConsumed} events: ${sseMsg}; attempting recovery via state poll`,
    );
    return pollAgentChatStateUntilDone(
      instance.gatewayHost,
      instance.gatewayPort,
      eventsConsumed,
      onAgentEvent,
    );
  }
}

function cancelStaleProcessingTurns(
  workspaceId: string,
  session: ChatSession,
): void {
  let cancelled = false;
  for (const message of session.messages) {
    if (message.role !== "assistant" || message.status !== "processing") {
      continue;
    }
    failAssistantMessage(message, "Stopped by user");
    publishTurnDone(
      turnWatchKey(workspaceId, session.sessionId, message.id),
      buildTurnDonePayload(session, message),
    );
    cancelled = true;
  }
  if (cancelled) {
    persistChatSession(session);
    setInstanceChatActive(workspaceId, false);
  }
}

function beginChatTurn(
  workspaceId: string,
  dto: ChatMessageDto,
): {
  instance: AgentInstance;
  session: ChatSession;
  userMsg: ConversationMessage;
  assistantMsg: ConversationMessage;
  watchKey: string;
} {
  if (!dto.message) {
    throw httpError("message is required", 400);
  }

  const instance = requireRunningInstance(workspaceId);
  const session = getOrCreateSession(workspaceId, dto.sessionId);
  cancelStaleProcessingTurns(workspaceId, session);
  const userFacingMessage =
    dto.displayMessage?.trim() ||
    extractUserFacingMessage(dto.message) ||
    dto.message;
  const userMsg = createUserMessage(userFacingMessage);
  const assistantMsg = createProcessingAssistantMessage();
  appendChatTurnMessages(session, userMsg, assistantMsg);

  const watchKey = turnWatchKey(
    workspaceId,
    session.sessionId,
    assistantMsg.id,
  );
  notifyTurnProgress(watchKey, session, assistantMsg);
  setInstanceChatActive(workspaceId, true);

  return { instance, session, userMsg, assistantMsg, watchKey };
}

async function finishChatTurn(
  workspaceId: string,
  session: ChatSession,
  assistantMsg: ConversationMessage,
  watchKey: string,
  result: GatewayResult,
): Promise<void> {
  finalizeAssistantMessage(assistantMsg, {
    answer: result.response.answer,
    question: result.response.question,
    images: result.response.images,
    response: result.response,
    usage: result.usage,
  });
  publishTurnDone(watchKey, buildTurnDonePayload(session, assistantMsg));
  persistChatSession(session);
}

function abortChatTurn(
  workspaceId: string,
  session: ChatSession,
  assistantMsg: ConversationMessage,
  watchKey: string,
  error: unknown,
): never {
  const msg = error instanceof Error ? error.message : String(error);
  failAssistantMessage(assistantMsg, msg);
  publishTurnDone(watchKey, buildTurnDonePayload(session, assistantMsg));
  persistChatSession(session);
  throw error instanceof Error ? error : new Error(msg);
}

function releaseChatTurn(workspaceId: string): void {
  cancelUiInputForWorkspace(workspaceId);
  setUiInputRequestListener(null);
  setInstanceChatActive(workspaceId, false);
}

/**
 * Run a chat turn to completion on an already-running instance.
 * Shared by `POST /instances/:id/chat` (async) and internal specialist-run.
 */
export async function executeChatTurnAndWait(
  workspaceId: string,
  dto: ChatMessageDto,
): Promise<{
  sessionId: string;
  assistantMessageId: string;
  messages: ConversationMessage[];
  compaction: CompactionInfo | null;
  result: GatewayResult;
}> {
  const { instance, session, assistantMsg, watchKey } = beginChatTurn(
    workspaceId,
    dto,
  );

  try {
    const result = await runChatTurnCore(
      workspaceId,
      instance,
      session,
      dto,
      assistantMsg,
      watchKey,
    );
    await finishChatTurn(workspaceId, session, assistantMsg, watchKey, result);
    return {
      sessionId: session.sessionId,
      assistantMessageId: assistantMsg.id,
      messages: enrichSessionMessages(session),
      compaction: session.compaction || null,
      result,
    };
  } catch (error) {
    abortChatTurn(workspaceId, session, assistantMsg, watchKey, error);
  } finally {
    releaseChatTurn(workspaceId);
  }
}

function runChatTurnInBackground(
  workspaceId: string,
  instance: AgentInstance,
  session: ChatSession,
  dto: ChatMessageDto,
  assistantMsg: ConversationMessage,
  watchKey: string,
): void {
  void (async () => {
    try {
      const result = await runChatTurnCore(
        workspaceId,
        instance,
        session,
        dto,
        assistantMsg,
        watchKey,
      );
      await finishChatTurn(
        workspaceId,
        session,
        assistantMsg,
        watchKey,
        result,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      failAssistantMessage(assistantMsg, msg);
      publishTurnDone(watchKey, buildTurnDonePayload(session, assistantMsg));
      persistChatSession(session);
    } finally {
      releaseChatTurn(workspaceId);
    }
  })();
}

export async function initiateChatTurn(
  workspaceId: string,
  dto: ChatMessageDto,
): Promise<{
  sessionId: string;
  assistantMessageId: string;
  messages: ConversationMessage[];
  compaction: CompactionInfo | null;
}> {
  const { instance, session, assistantMsg, watchKey } = beginChatTurn(
    workspaceId,
    dto,
  );
  runChatTurnInBackground(
    workspaceId,
    instance,
    session,
    dto,
    assistantMsg,
    watchKey,
  );

  return {
    sessionId: session.sessionId,
    assistantMessageId: assistantMsg.id,
    messages: enrichSessionMessages(session),
    compaction: session.compaction || null,
  };
}
