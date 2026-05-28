import {
  buildCodexDynamicToolsPromptAppendix,
  catalogToDynamicTools,
  resetCodexDynamicToolCacheForTests,
} from "../apps/api/src/lib/runners/codex-dynamic-tools.js";

describe("codex dynamic tools", () => {
  afterEach(() => {
    resetCodexDynamicToolCacheForTests();
  });

  it("maps tool host catalog entries to Codex dynamic tool specs", () => {
    const tools = catalogToDynamicTools({
      session: {
        workspaceId: "ws-1",
        specialistId: "document-editor",
        organizationId: "local",
        runner: "codex",
      },
      tools: [
        {
          name: "read_slide",
          label: "Read Slide",
          description: "Read a slide",
          parameters: {
            type: "object",
            properties: { slideIndex: { type: "number" } },
          },
        },
        {
          name: "invalid.tool",
          label: "Bad",
          description: "invalid name",
          parameters: { type: "object", properties: {} },
        },
      ],
      collections: [],
      skillPaths: [],
    });

    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      name: "read_slide",
      namespace: "dude",
      description: "Read a slide",
    });
  });

  it("builds prompt appendix without shell/curl instructions", () => {
    const appendix = buildCodexDynamicToolsPromptAppendix({
      session: {
        workspaceId: "ws-1",
        specialistId: "document-editor",
        organizationId: "local",
        runner: "codex",
      },
      tools: [
        {
          name: "read_slide",
          label: "Read Slide",
          description: "Read a slide",
          parameters: { type: "object", properties: {} },
        },
      ],
      collections: [],
      skillPaths: [],
    });

    expect(appendix).toContain("native Codex dynamic tools");
    expect(appendix).toContain("read_slide");
    expect(appendix).not.toContain("dude-dispatch-cli");
    expect(appendix).not.toMatch(/curl\s+-sS/);
    expect(appendix).toContain("dude_presentation_workflow");
    expect(appendix).toMatch(/There is NO generate_slide tool/);
  });

  it("rejects unknown dynamic tool namespaces", async () => {
    const { executeCodexDynamicToolCall } = await import(
      "../apps/api/src/lib/runners/codex-dynamic-tools.js"
    );

    const result = await executeCodexDynamicToolCall({
      threadId: "thread-1",
      turnId: "turn-1",
      callId: "call-1",
      tool: "read_slide",
      arguments: { slideIndex: 0 },
      namespace: "mcp",
    });

    expect(result.success).toBe(false);
    expect(result.contentItems[0]).toMatchObject({
      type: "inputText",
    });
    expect(String(result.contentItems[0]?.text)).toContain(
      'Unsupported dynamic tool namespace "mcp"',
    );
  });
});
