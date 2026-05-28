import {
  buildTurnProgressPayload,
  encodeChatTurnSse,
  publishTurnDone,
  publishTurnProgress,
  subscribeTurnDone,
  subscribeTurnProgress,
  turnWatchKey,
  type TurnDonePayload,
} from "../apps/api/src/lib/instances/chat-turn-watchers";
import type { ConversationMessage } from "../apps/api/src/lib/instances/conversation-message";

describe("chat-turn-watchers", () => {
  it("encodes SSE frames", () => {
    expect(encodeChatTurnSse("progress", { progressMessages: ["Working…"] })).toBe(
      'event: progress\ndata: {"progressMessages":["Working…"]}\n\n',
    );
  });

  it("notifies progress and done subscribers", async () => {
    const key = turnWatchKey("ws-1", "sess-1", "msg-1");
    const assistant: ConversationMessage = {
      id: "msg-1",
      role: "assistant",
      content: "Hello",
      status: "processing",
      traces: { steps: ["Thinking"], toolExecutions: [], durationMs: 0 },
      progressMessages: ["Working…"],
      createdAt: new Date().toISOString(),
    };

    const progressEvents: string[] = [];
    subscribeTurnProgress(key, (payload) => {
      progressEvents.push(payload.progressMessages?.[0] ?? "");
    });

    publishTurnProgress(
      key,
      buildTurnProgressPayload(assistant, null),
    );

    const done = await new Promise<TurnDonePayload>((resolve) => {
      subscribeTurnDone(key, resolve);
      publishTurnDone(key, {
        status: "completed",
        messages: [{ ...assistant, status: "completed" }],
      });
    });

    expect(progressEvents).toEqual(["Working…"]);
    expect(done.status).toBe("completed");
    expect(done.messages[0]?.content).toBe("Hello");
  });
});
