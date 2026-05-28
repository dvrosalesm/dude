import type { ChatSession } from "../apps/api/src/lib/instances/session-store.js";

const savedSessions = new Map<string, ChatSession>();

function key(workspaceId: string, sessionId: string) {
  return `${workspaceId}:${sessionId}`;
}

jest.mock("../apps/api/src/lib/instances/turn-store.js", () => ({
  ensureTurnStoreSchema: jest.fn(),
  saveChatSession: jest.fn((session: ChatSession) => {
    savedSessions.set(key(session.workspaceId, session.sessionId), {
      ...session,
      messages: session.messages.map((message) => ({ ...message })),
      compaction: session.compaction ? { ...session.compaction } : undefined,
    });
  }),
  loadChatSession: jest.fn((workspaceId: string, sessionId: string) => {
    const session = savedSessions.get(key(workspaceId, sessionId));
    return session
      ? {
          ...session,
          messages: session.messages.map((message) => ({ ...message })),
          compaction: session.compaction ? { ...session.compaction } : undefined,
        }
      : null;
  }),
  listChatSessionsForWorkspace: jest.fn((workspaceId: string) =>
    [...savedSessions.values()].filter(
      (session) => session.workspaceId === workspaceId,
    ),
  ),
  deleteChatSessionsForWorkspace: jest.fn((workspaceId: string) => {
    for (const sessionKey of [...savedSessions.keys()]) {
      if (sessionKey.startsWith(`${workspaceId}:`)) {
        savedSessions.delete(sessionKey);
      }
    }
  }),
  recoverStaleProcessingTurns: jest.fn(() => 0),
}));

import {
  clearSessionMemoryCacheForTests,
  getOrCreateSession,
  getSession,
  persistChatSession,
} from "../apps/api/src/lib/instances/session-store.js";

describe("session-store durable wiring", () => {
  beforeEach(() => {
    savedSessions.clear();
    clearSessionMemoryCacheForTests();
  });

  it("reloads persisted sessions after the memory cache is cleared", () => {
    const session = getOrCreateSession("ws-1", "sess-1");
    session.messages.push(
      {
        id: "user-1",
        role: "user",
        content: "Hello",
        status: "completed",
        createdAt: new Date().toISOString(),
      },
      {
        id: "assistant-1",
        role: "assistant",
        content: "Done",
        status: "completed",
        createdAt: new Date().toISOString(),
      },
    );
    persistChatSession(session);
    clearSessionMemoryCacheForTests();

    const reloaded = getSession("ws-1", "sess-1");
    expect(reloaded?.messages).toHaveLength(2);
    expect(reloaded?.messages[1]?.content).toBe("Done");
  });

  it("write-through persists appended turn messages", () => {
    const session = getOrCreateSession("ws-2", "sess-2");
    session.messages.push({
      id: "assistant-processing",
      role: "assistant",
      content: "",
      status: "processing",
      createdAt: new Date().toISOString(),
    });
    persistChatSession(session);
    clearSessionMemoryCacheForTests();

    const reloaded = getSession("ws-2", "sess-2");
    expect(reloaded?.messages[0]?.status).toBe("processing");
  });
});

describe("turn-store helpers", () => {
  it("marks processing messages as interrupted", () => {
    const { markInterruptedProcessingMessage } = jest.requireActual(
      "../apps/api/src/lib/instances/turn-store.js",
    ) as typeof import("../apps/api/src/lib/instances/turn-store.js");
    const completed = markInterruptedProcessingMessage({
      id: "m1",
      role: "assistant",
      content: "ok",
      status: "completed",
      createdAt: new Date().toISOString(),
    });
    expect(completed.status).toBe("completed");

    const interrupted = markInterruptedProcessingMessage({
      id: "m2",
      role: "assistant",
      content: "thinking",
      status: "processing",
      createdAt: new Date().toISOString(),
    });
    expect(interrupted.status).toBe("error");
    expect(interrupted.error).toMatch(/interrupted/i);
  });
});
