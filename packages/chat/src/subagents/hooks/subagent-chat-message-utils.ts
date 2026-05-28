import {
  collectImageUrlsFromToolExecutions,
  mergeImageUrlLists,
} from "@dude/gateway-shared/generated-image-urls";
import type { UiMessage } from "@dude/workspaces";
import type { SubagentMessage } from "../types";
import type { AssistantTurnPayload } from "./subagent-chat-types";

function imagesForAssistantTurn(data: AssistantTurnPayload): string[] | undefined {
  const fromPayload = data.images?.map((img) => img.url).filter(Boolean) ?? [];
  const fromTrace = collectImageUrlsFromToolExecutions(
    data.executionTrace?.toolExecutions,
  );
  return mergeImageUrlLists(fromPayload, fromTrace);
}

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
  const imageUrls = imagesForAssistantTurn(data);
  if (!nextMessage && !imageUrls?.length) return;
  setMessages((prev) => {
    const last = prev[prev.length - 1];
    if (
      last?.role === "assistant" &&
      last.message === nextMessage &&
      !imageUrls?.length
    ) {
      return prev;
    }
    return [
      ...prev,
      {
        message: nextMessage || "",
        answer: data.answer,
        role: "assistant",
        date: new Date().toISOString(),
        steps: data.steps,
        executionTrace: data.executionTrace,
        suggestions: data.suggestions,
        images: imageUrls,
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
