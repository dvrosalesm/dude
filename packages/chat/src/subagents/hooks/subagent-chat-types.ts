import type { ExecutionTrace, SubagentMessage } from "../types";

export interface UseSubagentChatConfig {
  subagentId: string;
  workspaceId: string | undefined;
  messages: SubagentMessage[];
  setMessages: React.Dispatch<React.SetStateAction<SubagentMessage[]>>;
  messagesLoaded: boolean;
  bootMessage?: string | (() => string);
  wakingUpLabel?: string;
  placeholder?: string;
  extraPayload?: () => Record<string, unknown>;
  onAssistantResponse?: () => void;
  onPendingEdits?: (edits: unknown[]) => void;
  disableHistory?: boolean;
  initialAttachments?: import("../types").ChatImageAttachment[];
  sendTurn?: (
    input: SubagentChatSendTurnInput,
  ) => Promise<SubagentChatSendTurnResult>;
  enableStop?: boolean;
  onPinMessage?: (messageId: string, pinned: boolean) => void;
  clearThread?: () => Promise<SubagentMessage[]>;
  respondUiInputTurn?: (input: {
    workspaceId: string;
    requestId: string;
    response: {
      action: "submit" | "cancel";
      confirmed?: boolean;
      value?: string;
      selectedOptionId?: string;
    };
  }) => Promise<void>;
}

export type SubagentChatSendTurnInput = {
  subagentId: string;
  workspaceId?: string;
  content: string;
  history: Array<{ role: string; content: string }>;
  imageUrls?: string[];
  files?: Array<{ name: string; mimeType: string }>;
  onProgress?: (update: {
    pendingUserInput?: unknown;
    executionTraces?: ExecutionTrace[];
    progressMessages?: string[];
  }) => void;
};

export type SubagentChatSendTurnResult = {
  answer?: string;
  question?: string;
  suggestions?: string[];
  steps?: string[];
  executionTrace?: ExecutionTrace;
  messages?: SubagentMessage[];
};

export type AssistantTurnPayload = {
  answer?: string;
  question?: string;
  steps?: string[];
  suggestions?: string[];
  images?: Array<{ url: string; alt?: string; caption?: string }>;
  executionTrace?: SubagentMessage["executionTrace"];
  messages?: SubagentMessage[];
};
