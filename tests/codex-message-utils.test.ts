import {
  createCodexStreamAnswerState,
  emitUserProgress,
  extractDynamicToolArguments,
  extractFinishTurnFromToolOutput,
  extractImageGenerationFromItem,
  extractSendProgressFromDynamicToolItem,
  extractSendProgressFromToolOutput,
  isAgentDispatchShellCommand,
  parseDispatchActionFromCommand,
  recordCompletedToolSummary,
  recordImageGenerationItem,
  resolveCodexAnswer,
  resolveCodexImages,
} from "../apps/api/src/lib/runners/codex-message-utils";

describe("codex-message-utils image generation", () => {
  it("extracts a data URL from image_generation_call items", () => {
    const image = extractImageGenerationFromItem({
      type: "image_generation_call",
      id: "ig_test",
      revised_prompt: "A fluffy cat",
      result: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ",
    });

    expect(image).not.toBeNull();
    expect(image?.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(image?.prompt).toBe("A fluffy cat");
  });

  it("records images and resolves answer text when Codex sends an empty final message", () => {
    const state = createCodexStreamAnswerState();
    recordImageGenerationItem(state, {
      type: "imageGeneration",
      revisedPrompt: "A fluffy cat",
      result: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ",
    });

    expect(resolveCodexImages(state)).toHaveLength(1);
    expect(resolveCodexAnswer(state)).toContain("Here's the image you requested.");
    expect(resolveCodexAnswer(state)).toContain("A fluffy cat");
  });

  it("deduplicates the same generated image", () => {
    const state = createCodexStreamAnswerState();
    const item = {
      type: "image_generation_call",
      result: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ",
    };

    recordImageGenerationItem(state, item);
    recordImageGenerationItem(state, item);

    expect(resolveCodexImages(state)).toHaveLength(1);
  });
});

describe("codex-message-utils dispatch output", () => {
  const dispatchCurl =
    '/bin/zsh -lc "curl -sS -X POST \'http://127.0.0.1:8787/v1/internal/agent/dispatch\' --data \'{\\"action\\":\\"finish_turn\\",\\"payload\\":{\\"answer\\":\\"Hi. I am ready.\\"}}\'"';

  const dispatchOutput = JSON.stringify({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          finished: true,
          answer: "Hi. I'm ready to help edit the presentation.",
        }),
      },
    ],
  });

  it("detects agent dispatch shell commands", () => {
    expect(isAgentDispatchShellCommand(dispatchCurl)).toBe(true);
    expect(parseDispatchActionFromCommand(dispatchCurl)).toBe("finish_turn");
  });

  it("extracts finish_turn answer from dispatch tool output", () => {
    const finish = extractFinishTurnFromToolOutput(dispatchOutput);
    expect(finish?.answer).toBe("Hi. I'm ready to help edit the presentation.");
  });

  it("falls back to send_progress messages when finish_turn was not called", () => {
    const state = createCodexStreamAnswerState();
    state.progressMessages.push("I'm reading the current slide.");

    expect(resolveCodexAnswer(state)).toBe("I'm reading the current slide.");
  });

  it("reads send_progress args from dynamic tool items", () => {
    expect(
      extractSendProgressFromDynamicToolItem({
        type: "dynamicToolCall",
        tool: "send_progress",
        arguments: { message: "Generating the lion slide…" },
      }),
    ).toBe("Generating the lion slide…");
  });

  it("extracts edit_document arguments from dynamic tool items", () => {
    expect(
      extractDynamicToolArguments({
        type: "dynamicToolCall",
        tool: "edit_document",
        arguments: {
          edits: [{ action: "replaceAll", title: "Resignation", blocks: [] }],
        },
      }),
    ).toEqual({
      edits: [{ action: "replaceAll", title: "Resignation", blocks: [] }],
    });
  });

  it("extracts send_progress message from tool host JSON output", () => {
    expect(
      extractSendProgressFromToolOutput(
        JSON.stringify({ ok: true, message: "Reading slides…" }),
      ),
    ).toBe("Reading slides…");
  });

  it("emitUserProgress records progress without requiring loop steps", () => {
    const answerState = createCodexStreamAnswerState();
    const events: Array<{ event: string; data: Record<string, unknown> }> = [];

    emitUserProgress("Updating the document…", (event, data) => {
      events.push({
        event,
        data: data as Record<string, unknown>,
      });
    }, answerState);

    expect(events).toEqual([
      { event: "progress_message", data: { message: "Updating the document…" } },
    ]);
    expect(answerState.progressMessages).toEqual(["Updating the document…"]);

    const steps: string[] = [];
    emitUserProgress(
      "Applying edits…",
      () => {},
      answerState,
      steps,
    );
    expect(steps).toEqual(["Applying edits…"]);
  });

  it("prefers finish_turn answer over raw curl output in resolveCodexAnswer", () => {
    const state = createCodexStreamAnswerState();
    state.answerParts.push(dispatchCurl);
    state.answerParts.push(dispatchOutput);

    recordCompletedToolSummary(state, {
      type: "commandExecution",
      command: dispatchCurl,
      aggregatedOutput: dispatchOutput,
      status: "completed",
    });

    expect(resolveCodexAnswer(state)).toBe(
      "Hi. I'm ready to help edit the presentation.",
    );
  });
});
