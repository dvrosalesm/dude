import {
  applyTraceEvent,
  createTraceState,
} from "../apps/api/src/lib/trace-formatter";

describe("trace-formatter thinking dedupe", () => {
  it("does not stack duplicate Thinking steps", () => {
    const state = createTraceState();

    applyTraceEvent(state, { event: "thinking_start", data: {} });
    applyTraceEvent(state, { event: "thinking_start", data: {} });

    expect(state.steps).toEqual(["Thinking…"]);
  });

  it("skips noisy send_progress tool rows", () => {
    const state = createTraceState();

    applyTraceEvent(state, { event: "progress_message", data: { message: "Updating the doc…" } });
    applyTraceEvent(state, { event: "tool_call_start", data: { name: "send_progress" } });
    applyTraceEvent(state, { event: "tool_call", data: { name: "send_progress", arguments: {} } });
    applyTraceEvent(state, { event: "tool_result", data: { name: "send_progress", result: "{}" } });

    expect(state.steps).toEqual(["Updating the doc…"]);
    expect(state.toolExecutions).toHaveLength(0);
  });

  it("records compaction, error, and preview_draft events", () => {
    const state = createTraceState();

    applyTraceEvent(state, { event: "compaction", data: { tokensBefore: 12000 } });
    applyTraceEvent(state, { event: "error", data: { message: "Tool host unavailable" } });
    applyTraceEvent(state, { event: "preview_draft", data: { size: 2048 } });
    applyTraceEvent(state, { event: "heartbeat", data: {} });

    expect(state.steps).toEqual([
      "Compacted earlier history (~12000 tokens)",
      "Error: Tool host unavailable",
      "Drafting page preview (2.0KB)",
    ]);
  });
});
