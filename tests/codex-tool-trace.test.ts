import {
  applyTraceEvent,
  createTraceState,
} from "../apps/api/src/lib/trace-formatter";
import { normalizeGatewayEvent } from "../apps/api/src/lib/gateway-event-normalize";

describe("codex dynamic tool traces", () => {
  it("records edit_document arguments from toolcall events", () => {
    const state = createTraceState();

    applyTraceEvent(
      state,
      normalizeGatewayEvent({
        event: "toolcall_start",
        data: { name: "edit_document" },
      }),
    );
    applyTraceEvent(
      state,
      normalizeGatewayEvent({
        event: "toolcall",
        data: {
          name: "edit_document",
          arguments: {
            edits: [{ action: "replaceAll", title: "Letter", blocks: [] }],
          },
        },
      }),
    );
    applyTraceEvent(
      state,
      normalizeGatewayEvent({
        event: "toolcall_end",
        data: { name: "edit_document", result: '{"success":true}' },
      }),
    );

    expect(state.toolExecutions).toHaveLength(1);
    expect(state.toolExecutions[0]?.tool).toBe("edit_document");
    expect(state.toolExecutions[0]?.arguments).toEqual({
      edits: [{ action: "replaceAll", title: "Letter", blocks: [] }],
    });
    expect(state.toolExecutions[0]?.result).toEqual({ success: true });
  });
});
