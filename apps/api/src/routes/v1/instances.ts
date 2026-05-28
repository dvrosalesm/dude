import { Elysia } from "elysia";
import type {
  SpawnInstanceDto,
  ChatMessageDto,
  QueryDto,
} from "../../lib/types.js";
import {
  getInstance,
  listInstances,
} from "../../lib/instance-manager.js";
import { initiateChatTurn } from "../../lib/instances/chat-turn-orchestrator.js";
import {
  buildTurnDonePayload,
  buildTurnProgressPayload,
  createChatTurnSseStream,
  turnWatchKey,
} from "../../lib/instances/chat-turn-watchers.js";
import {
  enrichSessionMessages,
  getSession,
  listSessionsForWorkspace,
} from "../../lib/instances/session-store.js";
import {
  queryWorkspace,
  spawnInstance,
  stopWorkspace,
} from "../../lib/instances/instance-handlers.js";
import { respondToUiInput } from "./ui-input-handlers.js";
import { getPendingUiInput } from "../../lib/ui-input-store.js";
import { apiKeyAuth, handleRouteError } from "./middleware.js";

export const instanceRoutes = new Elysia({ prefix: "/instances" })
  .use(apiKeyAuth)
  .post("/", async ({ body, set }) => {
    try {
      return await spawnInstance(body as SpawnInstanceDto);
    } catch (error) {
      return handleRouteError(error, set);
    }
  })
  .get("/", () => listInstances())
  .get("/:workspaceId", ({ params: { workspaceId }, set }) => {
    const instance = getInstance(workspaceId);
    if (!instance) {
      set.status = 404;
      return { error: `No instance found for workspace ${workspaceId}` };
    }
    return instance;
  })
  .delete("/:workspaceId", async ({ params: { workspaceId }, set }) => {
    try {
      return await stopWorkspace(workspaceId);
    } catch (error) {
      return handleRouteError(error, set);
    }
  })
  .post("/:workspaceId/chat", async ({ params: { workspaceId }, body, set }) => {
    try {
      return await initiateChatTurn(workspaceId, body as ChatMessageDto);
    } catch (error) {
      return handleRouteError(error, set);
    }
  })
  .get("/:workspaceId/chat/stream", ({ params: { workspaceId }, query, set }) => {
    const sessionId = query.sessionId as string | undefined;
    const messageId = query.messageId as string | undefined;
    if (!sessionId || !messageId) {
      set.status = 400;
      return { error: "sessionId and messageId are required" };
    }

    const session = getSession(workspaceId, sessionId);
    if (!session) {
      set.status = 404;
      return { error: "Session not found" };
    }

    const assistantMsg = session.messages.find(
      (message) => message.id === messageId && message.role === "assistant",
    );
    if (!assistantMsg) {
      set.status = 404;
      return { error: "Assistant message not found" };
    }

    const watchKey = turnWatchKey(workspaceId, sessionId, messageId);
    const initialDone =
      assistantMsg.status !== "processing"
        ? buildTurnDonePayload(session, assistantMsg)
        : undefined;
    const initialProgress = initialDone
      ? undefined
      : buildTurnProgressPayload(
          assistantMsg,
          getPendingUiInput(workspaceId),
        );

    set.headers["Content-Type"] = "text/event-stream";
    set.headers["Cache-Control"] = "no-cache";
    set.headers["Connection"] = "keep-alive";
    return createChatTurnSseStream({
      key: watchKey,
      initialProgress,
      initialDone,
    });
  })
  .get("/:workspaceId/chat", ({ params: { workspaceId }, query }) => {
    const sessionId = query.sessionId as string | undefined;
    if (sessionId) {
      const session = getSession(workspaceId, sessionId);
      if (!session) {
        return { sessionId, messages: [] };
      }
      return {
        sessionId: session.sessionId,
        messages: enrichSessionMessages(session),
        compaction: session.compaction || null,
      };
    }

    const workspaceSessions = listSessionsForWorkspace(workspaceId);
    return {
      sessions: workspaceSessions.map((s) => ({
        sessionId: s.sessionId,
        messageCount: s.messages.length,
        createdAt: s.createdAt,
        lastMessageAt:
          s.messages.length > 0
            ? s.messages[s.messages.length - 1].createdAt
            : s.createdAt,
      })),
    };
  })
  .post("/:workspaceId/query", async ({ params: { workspaceId }, body, set }) => {
    try {
      return await queryWorkspace(workspaceId, body as QueryDto);
    } catch (error) {
      return handleRouteError(error, set);
    }
  })
  .post(
    "/:workspaceId/ui-input/:requestId/respond",
    async ({ params: { requestId }, body, set }) => {
      try {
        return await respondToUiInput(requestId, body as Record<string, unknown>);
      } catch (error) {
        return handleRouteError(error, set);
      }
    },
  );
