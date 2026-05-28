export type CodexAgentMessagePhase =
  | "commentary"
  | "final_answer"
  | "finalAnswer"
  | string;

export interface CodexGeneratedImage {
  dataUrl: string;
  prompt?: string;
  savedPath?: string;
}

export interface CodexStreamAnswerState {
  answerParts: string[];
  messageDeltas: Map<string, string>;
  completedMessages: Array<{ text: string; phase?: CodexAgentMessagePhase }>;
  toolSummaries: string[];
  generatedImages: CodexGeneratedImage[];
  /** Parsed from finish_turn dispatch responses — user-visible final answer. */
  dispatchFinish?: { answer: string; suggestions?: string[] };
  progressMessages: string[];
}

export function createCodexStreamAnswerState(): CodexStreamAnswerState {
  return {
    answerParts: [],
    messageDeltas: new Map(),
    completedMessages: [],
    toolSummaries: [],
    generatedImages: [],
    progressMessages: [],
  };
}

const DISPATCH_SHELL_NOISE =
  /\/bin\/zsh\s+-lc|"curl\s+.*agent\/dispatch|v1\/internal\/agent\/dispatch|dude-dispatch-cli\.ts|\{"content":\[\{"type":"text"/i;

export function isAgentDispatchShellCommand(command: string): boolean {
  return (
    /\/v1\/internal\/agent\/dispatch/i.test(command) ||
    /dude-dispatch-cli\.ts/i.test(command)
  );
}

export function parseDispatchActionFromCommand(command: string): string | null {
  const normalized = command.replace(/\\"/g, '"');

  const cliMatch = normalized.match(
    /dude-dispatch-cli\.ts(?:\s+--manifest\s+[^\s]+)?\s+([a-z_][a-z0-9_]*)\s+/i,
  );
  if (cliMatch?.[1]) {
    return cliMatch[1].trim();
  }

  const match = normalized.match(/"action"\s*:\s*"([^"]+)"/);
  return match?.[1]?.trim() || null;
}

export function parseToolHostResponsePayload(
  raw: string,
): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const tryParse = (text: string): Record<string, unknown> | null => {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const outer = tryParse(trimmed);
  if (outer && Array.isArray(outer.content)) {
    for (const part of outer.content) {
      if (!part || typeof part !== "object") continue;
      const record = part as Record<string, unknown>;
      if (record.type === "text" && typeof record.text === "string") {
        const inner = tryParse(record.text);
        if (inner) return inner;
        return { text: record.text };
      }
    }
  }

  if (outer) return outer;

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  return jsonMatch ? tryParse(jsonMatch[0]) : null;
}

export function extractFinishTurnFromToolOutput(
  output: string,
): { answer: string; suggestions?: string[] } | null {
  const parsed = parseToolHostResponsePayload(output);
  if (!parsed || parsed.finished !== true) return null;

  const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
  if (!answer) return null;

  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
        .slice(0, 4)
    : undefined;

  return { answer, suggestions };
}

export function extractSendProgressFromToolOutput(output: string): string | null {
  const parsed = parseToolHostResponsePayload(output);
  if (!parsed) return null;

  const message =
    typeof parsed.message === "string"
      ? parsed.message.trim()
      : typeof parsed.text === "string"
        ? parsed.text.trim()
        : "";
  return message || null;
}

function readDynamicToolRawArguments(
  item: Record<string, unknown>,
): unknown {
  return (
    item.arguments ??
    item.params ??
    item.input ??
    item.functionArguments
  );
}

/** Parse dynamic/mcp tool arguments from a Codex item payload. */
export function extractDynamicToolArguments(
  item: Record<string, unknown>,
): Record<string, unknown> {
  const rawArgs = readDynamicToolRawArguments(item);
  if (!rawArgs) return {};

  if (typeof rawArgs === "string") {
    const parsed = parseToolHostResponsePayload(rawArgs);
    return parsed ?? {};
  }

  if (typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
    return rawArgs as Record<string, unknown>;
  }

  return {};
}

/** Read send_progress args from a Codex dynamicToolCall item (before result is available). */
export function extractSendProgressFromDynamicToolItem(
  item: Record<string, unknown>,
): string | null {
  const tool =
    typeof item.tool === "string"
      ? item.tool
      : typeof item.name === "string"
        ? item.name
        : "";
  if (tool !== "send_progress") return null;

  const args = extractDynamicToolArguments(item);
  if (!args) return null;

  const message = typeof args.message === "string" ? args.message.trim() : "";
  return message || null;
}

export function emitUserProgress(
  message: string,
  sendEvent: (event: string, data: unknown) => void,
  answerState: CodexStreamAnswerState,
  steps?: string[],
): void {
  const text = message.trim();
  if (!text) return;
  sendEvent("progress_message", { message: text });
  answerState.progressMessages.push(text);
  steps?.push(text);
}

function isDispatchShellNoise(text: string): boolean {
  return DISPATCH_SHELL_NOISE.test(text);
}

const IMAGE_GENERATION_ITEM_TYPES = new Set([
  "imageGeneration",
  "image_generation_call",
  "ImageGenerationCall",
]);

function readStringField(
  item: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function inferImageMime(base64: string): string {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("R0lGOD")) return "image/gif";
  if (base64.startsWith("UklGR")) return "image/webp";
  return "image/png";
}

/** Build a data URL from Codex image_generation_call payload fields. */
export function extractImageGenerationFromItem(
  item: Record<string, unknown>,
): CodexGeneratedImage | null {
  const type = typeof item.type === "string" ? item.type : "";
  if (!IMAGE_GENERATION_ITEM_TYPES.has(type)) return null;

  const prompt = readStringField(item, "revisedPrompt", "revised_prompt");
  const savedPath = readStringField(item, "savedPath", "saved_path");
  const result = readStringField(item, "result");

  if (result) {
    const mime = inferImageMime(result);
    return {
      dataUrl: `data:${mime};base64,${result}`,
      prompt: prompt || undefined,
      savedPath: savedPath || undefined,
    };
  }

  return savedPath
    ? { dataUrl: "", prompt: prompt || undefined, savedPath }
    : null;
}

export function recordImageGenerationItem(
  state: CodexStreamAnswerState,
  item: Record<string, unknown>,
): CodexGeneratedImage | null {
  const image = extractImageGenerationFromItem(item);
  if (!image) return null;

  const alreadyRecorded = state.generatedImages.some(
    (entry) =>
      (entry.savedPath && entry.savedPath === image.savedPath) ||
      (entry.dataUrl && image.dataUrl && entry.dataUrl === image.dataUrl),
  );
  if (alreadyRecorded) return image;

  state.generatedImages.push(image);
  return image;
}

export function resolveCodexImages(state: CodexStreamAnswerState): string[] {
  return state.generatedImages
    .map((entry) => entry.dataUrl)
    .filter((url) => typeof url === "string" && url.startsWith("data:"));
}

/** Extract user-visible text from a Codex `agentMessage` item (legacy + content[] shapes). */
export function extractAgentMessageText(item: Record<string, unknown>): string {
  if (typeof item.text === "string" && item.text.trim()) {
    return item.text.trim();
  }

  if (typeof item.message === "string" && item.message.trim()) {
    return item.message.trim();
  }

  const content = item.content;
  if (!Array.isArray(content)) return "";

  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const record = block as Record<string, unknown>;
    if (typeof record.text === "string" && record.text.trim()) {
      parts.push(record.text.trim());
      continue;
    }
    if (
      record.type === "text" &&
      typeof record.text === "string" &&
      record.text.trim()
    ) {
      parts.push(record.text.trim());
    }
  }

  return parts.join("\n\n").trim();
}

export function extractAgentMessagePhase(
  item: Record<string, unknown>,
): CodexAgentMessagePhase | undefined {
  return typeof item.phase === "string" ? item.phase : undefined;
}

export function appendAgentMessageDelta(
  state: CodexStreamAnswerState,
  params: unknown,
): void {
  const record =
    params && typeof params === "object"
      ? (params as Record<string, unknown>)
      : {};

  const delta =
    typeof record.delta === "string"
      ? record.delta
      : typeof record.text === "string"
        ? record.text
        : typeof record.message === "string"
          ? record.message
          : "";

  if (!delta) return;

  const itemId =
    typeof record.itemId === "string"
      ? record.itemId
      : typeof record.id === "string"
        ? record.id
        : "_default";

  const previous = state.messageDeltas.get(itemId) ?? "";
  state.messageDeltas.set(itemId, previous + delta);
  state.answerParts.push(delta);
}

export function recordCompletedAgentMessage(
  state: CodexStreamAnswerState,
  item: Record<string, unknown>,
): void {
  const text = extractAgentMessageText(item);
  if (!text) return;

  const phase = extractAgentMessagePhase(item);
  state.completedMessages.push({ text, phase });

  const itemId = typeof item.id === "string" ? item.id : "_default";
  state.messageDeltas.set(itemId, text);
}

export function recordCompletedToolSummary(
  state: CodexStreamAnswerState,
  item: Record<string, unknown>,
): void {
  if (item.type === "commandExecution") {
    const command = typeof item.command === "string" ? item.command : "command";
    const output =
      typeof item.aggregatedOutput === "string"
        ? item.aggregatedOutput.trim().slice(0, 1500)
        : "";
    const status = typeof item.status === "string" ? item.status : "";

    if (output && isAgentDispatchShellCommand(command)) {
      const finish = extractFinishTurnFromToolOutput(output);
      if (finish) {
        state.dispatchFinish = finish;
      } else {
        const progress = extractSendProgressFromToolOutput(output);
        if (progress) state.progressMessages.push(progress);
      }

      const action = parseDispatchActionFromCommand(command);
      if (action) {
        state.toolSummaries.push(`Called **${action}** (${status || "done"})`);
      }
      return;
    }

    if (output) {
      state.toolSummaries.push(
        `**${command}** (${status || "done"})\n\`\`\`\n${output}\n\`\`\``,
      );
    } else if (status) {
      state.toolSummaries.push(`**${command}** (${status})`);
    }
    return;
  }

  if (item.type === "mcpToolCall") {
    const tool = typeof item.tool === "string" ? item.tool : "tool";
    const result = item.result ?? item.error ?? item.status;
    if (result != null && String(result).trim()) {
      state.toolSummaries.push(
        `**${tool}**\n\`\`\`\n${String(result).trim().slice(0, 1500)}\n\`\`\``,
      );
    }
  }
}

export function resolveCodexAnswer(state: CodexStreamAnswerState): string {
  if (state.dispatchFinish?.answer) {
    return state.dispatchFinish.answer;
  }

  const finalMessages = state.completedMessages
    .filter(
      (entry) =>
        !entry.phase ||
        entry.phase === "final_answer" ||
        entry.phase === "finalAnswer",
    )
    .map((entry) => entry.text)
    .filter((text) => text && !isDispatchShellNoise(text));

  if (finalMessages.length > 0) {
    return finalMessages.join("\n\n").trim();
  }

  const commentary = state.completedMessages
    .filter((entry) => entry.phase === "commentary")
    .map((entry) => entry.text)
    .filter((text) => text && !isDispatchShellNoise(text));
  if (commentary.length > 0) {
    return commentary.join("\n\n").trim();
  }

  const anyCompleted = state.completedMessages
    .map((entry) => entry.text)
    .filter((text) => text && !isDispatchShellNoise(text));
  if (anyCompleted.length > 0) {
    return anyCompleted.join("\n\n").trim();
  }

  const deltaText = [...state.messageDeltas.values()]
    .join("")
    .trim();
  if (deltaText && !isDispatchShellNoise(deltaText)) return deltaText;

  const streamed = state.answerParts.join("").trim();
  if (streamed && !isDispatchShellNoise(streamed)) return streamed;

  const progress = state.progressMessages
    .map((message) => message.trim())
    .filter(Boolean);
  if (progress.length > 0) {
    return progress.join("\n\n");
  }

  if (state.generatedImages.length > 0) {
    const prompt = state.generatedImages[0]?.prompt?.trim();
    return prompt
      ? `Here's the image you requested.\n\n*${prompt}*`
      : "Here's the generated image.";
  }

  return "";
}
