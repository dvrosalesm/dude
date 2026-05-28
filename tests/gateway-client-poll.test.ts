import { createChatStateBuffer } from "../apps/api/src/lib/runners/adapter-http.js";

describe("chat state buffer snapshot cursor", () => {
  it("uses eventCount so poll clients can resume after buffer trimming", () => {
    const chatState = createChatStateBuffer();
    chatState.reset("chat-1");

    chatState.record("thinking_start", {});
    chatState.record("toolcall_start", { name: "edit_document" });
    chatState.record("toolcall", {
      name: "edit_document",
      arguments: { edits: [{ op: "replace", text: "Hello" }] },
    });

    const first = chatState.snapshot(0);
    expect(first.eventCount).toBe(3);
    expect(first.events).toHaveLength(3);

    const second = chatState.snapshot(first.eventCount);
    expect(second.events).toHaveLength(0);
    expect(second.status).toBe("processing");
  });
});

describe("liveTraceLabel", () => {
  it("prefers the latest non-generic step over Thinking", async () => {
    const { liveTraceLabel } = await import(
      "../packages/chat/src/subagents/subagent-chat/trace-steps.ts"
    );

    expect(
      liveTraceLabel([
        {
          id: "trace-1",
          timestamp: new Date().toISOString(),
          steps: ["Thinking…", "Updating the document…"],
          toolExecutions: [],
          durationMs: 0,
        },
      ]),
    ).toBe("Updating the document…");
  });
});
