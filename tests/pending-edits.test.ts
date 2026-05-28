import { extractPendingEditsFromTraces } from "../packages/chat/src/subagents/hooks/pending-edits";

describe("extractPendingEditsFromTraces", () => {
  it("pulls edits from edit_document tool arguments", () => {
    const edits = extractPendingEditsFromTraces([
      {
        id: "trace-1",
        timestamp: new Date().toISOString(),
        steps: ["Editing the document…"],
        toolExecutions: [
          {
            tool: "edit_document",
            arguments: {
              edits: [
                {
                  action: "replaceAll",
                  title: "Resignation Letter",
                  blocks: [{ type: "paragraph", content: "Dear Manager," }],
                },
              ],
            },
            result: { success: true },
          },
        ],
        durationMs: 1200,
      },
    ]);

    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({
      action: "replaceAll",
      title: "Resignation Letter",
    });
  });

  it("ignores unrelated tools", () => {
    expect(
      extractPendingEditsFromTraces([
        {
          id: "trace-1",
          timestamp: new Date().toISOString(),
          steps: [],
          toolExecutions: [
            {
              tool: "web_search",
              arguments: { query: "resignation letter" },
              result: {},
            },
          ],
          durationMs: 0,
        },
      ]),
    ).toEqual([]);
  });
});
