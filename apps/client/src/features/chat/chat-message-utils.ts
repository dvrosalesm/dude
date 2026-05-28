import type {
  ChatImageAttachment,
  ExecutionTrace,
  SubagentMessage,
} from "@dude/chat/subagents/types";
import type { LocalChatMessage } from "../../types";

export function toSubagentMessage(message: LocalChatMessage): SubagentMessage {
  return {
    id: message.id,
    role: message.role,
    message: message.content,
    date: message.createdAt,
    pinned: message.pinned,
    images: message.images,
    files: message.files,
    suggestions: message.suggestions,
    executionTrace: message.executionTrace as ExecutionTrace | undefined,
  };
}

export function fileToAttachment(file: File): Promise<ChatImageAttachment> {
  if (!file.type.startsWith("image/")) {
    return Promise.resolve({
      id: `${file.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      dataUrl: "placeholder",
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: `${file.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        mimeType: file.type,
        dataUrl: String(reader.result),
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
