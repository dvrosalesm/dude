import type { UiMessage } from "@dude/workspaces";
import type { SubagentMessage } from "../types";
import type { AssistantTurnPayload } from "./subagent-chat-types";

export function uiMessageToSubagentMessage(message: UiMessage): SubagentMessage {
  return {
    id: message.id,
    role: message.role,
    message: message.message,
    date: message.date,
    images: message.images,
    files: message.files,
  };
}

export function appendAssistantMessage(
  setMessages: React.Dispatch<React.SetStateAction<SubagentMessage[]>>,
  data: AssistantTurnPayload,
): void {
  const nextMessage = data.answer || data.question || "";
  if (!nextMessage) return;
  const imageUrls = data.images?.map((img) => img.url).filter(Boolean);
  setMessages((prev) => {
    const last = prev[prev.length - 1];
    if (last?.role === "assistant" && last.message === nextMessage) {
      return prev;
    }
    return [
      ...prev,
      {
        message: nextMessage,
        answer: data.answer,
        role: "assistant",
        date: new Date().toISOString(),
        steps: data.steps,
        executionTrace: data.executionTrace,
        suggestions: data.suggestions,
        images: imageUrls?.length ? imageUrls : undefined,
      },
    ];
  });
}

export function applyAssistantTurnResult(params: {
  pendingId?: string;
  result: AssistantTurnPayload;
  setMessages: React.Dispatch<React.SetStateAction<SubagentMessage[]>>;
  onAssistantResponse?: () => void;
}): void {
  const { pendingId, result, setMessages, onAssistantResponse } = params;

  if (result.messages?.length) {
    setMessages((prev) => [
      ...prev.filter((message) => message.id !== pendingId),
      ...result.messages!,
    ]);
  } else {
    if (pendingId) {
      setMessages((prev) => prev.filter((message) => message.id !== pendingId));
    }
    appendAssistantMessage(setMessages, result);
  }
  onAssistantResponse?.();
}

export function workspaceBootKey(subagentId: string, workspaceId: string): string {
  return `${subagentId}:${workspaceId}`;
}

/** Survives React StrictMode remounts so boot greetings only fire once per workspace. */
export const bootedWorkspaceKeys = new Set<string>();
