import {
  applyTraceEvent,
  createTraceState,
} from "../apps/api/src/lib/trace-formatter";
import { normalizeGatewayEvent } from "../apps/api/src/lib/gateway-event-normalize";

describe("normalizeGatewayEvent", () => {
  it("maps codex toolcall aliases to canonical tool_call events", () => {
    expect(
      normalizeGatewayEvent({
        event: "toolcall_start",
        data: { name: "image_gen" },
      }),
    ).toEqual({
      event: "tool_call_start",
      data: { name: "image_gen", tool: "image_gen" },
    });

    expect(
      normalizeGatewayEvent({
        event: "toolcall",
        data: { name: "shell", arguments: { cwd: "/tmp" } },
      }),
    ).toEqual({
      event: "tool_call",
      data: { name: "shell", tool: "shell", arguments: { cwd: "/tmp" } },
    });

    expect(
      normalizeGatewayEvent({
        event: "toolcall_end",
        data: { name: "shell", result: "ok" },
      }),
    ).toEqual({
      event: "tool_result",
      data: { name: "shell", tool: "shell", result: "ok" },
    });
  });

  it("leaves canonical events unchanged", () => {
    const evt = {
      event: "text_delta",
      data: { delta: "hello" },
    };
    expect(normalizeGatewayEvent(evt)).toBe(evt);
  });
});

describe("applyTraceEvent with normalized codex events", () => {
  it("records tool execution lifecycle from toolcall_* aliases", () => {
    const state = createTraceState();

    applyTraceEvent(
      state,
      normalizeGatewayEvent({
        event: "toolcall_start",
        data: { name: "image_gen" },
      }),
    );
    applyTraceEvent(
      state,
      normalizeGatewayEvent({
        event: "toolcall",
        data: { name: "image_gen", arguments: { prompt: "cat" } },
      }),
    );
    applyTraceEvent(
      state,
      normalizeGatewayEvent({
        event: "toolcall_end",
        data: { name: "image_gen", result: '{"url":"https://x"}' },
      }),
    );

    expect(state.toolExecutions).toHaveLength(1);
    expect(state.toolExecutions[0]?.tool).toBe("image_gen");
    expect(state.toolExecutions[0]?.result).toEqual({ url: "https://x" });
    expect(state.steps.length).toBeGreaterThan(0);
  });
});
