import {
  buildHostedConversationMessages,
  buildHostedSystemPrompt,
  buildHostedUserContent,
  buildSkillPackHint,
} from "../apps/api/src/lib/runners/hosted-agent-loop-helpers";

describe("hosted agent loop helpers", () => {
  const catalog = {
    session: {
      workspaceId: "ws-1",
      subagentId: "document-editor",
      organizationId: "org-1",
      runner: "codex",
    },
    tools: [
      {
        name: "edit_presentation",
        label: "Edit Presentation",
        description: "Apply slide edits",
        parameters: { type: "object", properties: {} },
      },
      {
        name: "read_slide",
        label: "Read Slide",
        description: "Read slide content",
        parameters: { type: "object", properties: {} },
      },
    ],
    collections: ["documentEdits"],
    skillPaths: [
      "/app/skills/document-editor/baoyu-slide-deck",
      "/app/skills/document-editor/pptx-generator",
    ],
  };

  it("appends attached image URLs to the user message", () => {
    expect(
      buildHostedUserContent("Update slide 1", ["https://example.com/a.png"]),
    ).toContain("[Attached image 1]: https://example.com/a.png");
  });

  it("includes skill pack names and tool list in the system prompt", () => {
    const prompt = buildHostedSystemPrompt(catalog, "You are the deck editor.");
    expect(prompt).toContain("You are the deck editor.");
    expect(prompt).toContain("baoyu-slide-deck");
    expect(prompt).toContain("edit_presentation");
    expect(prompt).toContain("finish_turn");
  });

  it("builds conversation messages with history before the latest user turn", () => {
    const messages = buildHostedConversationMessages(
      {
        message: "Add a title slide",
        history: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there" },
        ],
      },
      catalog,
    );

    expect(messages).toHaveLength(4);
    expect(messages[0]?.role).toBe("system");
    expect(messages[1]).toEqual({ role: "user", content: "Hello" });
    expect(messages[2]).toEqual({ role: "assistant", content: "Hi there" });
    expect(messages[3]).toEqual({ role: "user", content: "Add a title slide" });
  });

  it("formats skill pack hint from path basenames", () => {
    expect(buildSkillPackHint(catalog.skillPaths)).toContain("pptx-generator");
  });
});
