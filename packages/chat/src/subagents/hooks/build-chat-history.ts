import type { SubagentMessage } from "../types";

export function buildAttachedFilePromptBlock(fileUrls: string[]): string {
  if (!fileUrls.length) return "";
  return [
    "",
    "[Attached file URLs]",
    "Use these exact URLs if you need to reference, analyze, reuse, or insert the attached files in a tool call or final answer.",
    ...fileUrls.map((url, index) => `${index + 1}. ${url}`),
  ].join("\n");
}

export function buildChatHistory(
  messages: SubagentMessage[],
  disableHistory?: boolean,
): Array<{ role: string; content: string }> {
  if (disableHistory) return [];

  const MAX_HISTORY = 20;
  const chatMessages = messages.filter(
    (m) => m.role === "user" || m.role === "assistant" || m.role === "compaction",
  );

  const lastCompactionIdx = chatMessages.findLastIndex((m) => m.role === "compaction");
  if (lastCompactionIdx >= 0) {
    const compaction = chatMessages[lastCompactionIdx];
    const afterCompaction = chatMessages
      .slice(lastCompactionIdx + 1)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.message || m.answer || "" }));
    return [
      { role: "system", content: `[Previous conversation summary]\n${compaction.message}` },
      ...afterCompaction,
    ];
  }

  return chatMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.message || m.answer || "" }));
}
