import {
  liveTraceLabel,
  normalizeTraceSteps,
} from "../packages/chat/src/specialists/specialist-chat/trace-steps";

describe("trace-steps", () => {
  it("collapses duplicate generic thinking steps", () => {
    expect(
      normalizeTraceSteps(["Thinking…", "Thinking…", "Thinking…"]),
    ).toEqual(["Thinking…"]);
  });

  it("prefers meaningful steps over generic placeholders", () => {
    expect(
      normalizeTraceSteps([
        "Thinking…",
        "Editing the document…",
        "Edited the document",
      ]),
    ).toEqual(["Editing the document…", "Edited the document"]);
  });

  it("uses pending tool labels for live trace text", () => {
    expect(
      liveTraceLabel([
        {
          id: "trace-1",
          timestamp: new Date().toISOString(),
          steps: ["Thinking…"],
          toolExecutions: [
            {
              tool: "edit_document",
              arguments: { edits: [{ action: "replaceAll", blocks: [] }] },
              result: null,
            },
          ],
          durationMs: 0,
        },
      ]),
    ).toBe("Editing the document (1 change)…");
  });
});
