import type { ExecutionTrace, SpecialistMessage } from "../types";

export interface UseSpecialistChatConfig {
  specialistId: string;
  workspaceId: string | undefined;
  messages: SpecialistMessage[];
  setMessages: React.Dispatch<React.SetStateAction<SpecialistMessage[]>>;
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
    input: SpecialistChatSendTurnInput,
  ) => Promise<SpecialistChatSendTurnResult>;
  enableStop?: boolean;
  onPinMessage?: (messageId: string, pinned: boolean) => void;
  clearThread?: () => Promise<SpecialistMessage[]>;
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

export type SpecialistChatSendTurnInput = {
  specialistId: string;
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

export type SpecialistChatSendTurnResult = {
  answer?: string;
  question?: string;
  suggestions?: string[];
  steps?: string[];
  executionTrace?: ExecutionTrace;
  messages?: SpecialistMessage[];
};

export type AssistantTurnPayload = {
  answer?: string;
  question?: string;
  steps?: string[];
  suggestions?: string[];
  images?: Array<{ url: string; alt?: string; caption?: string }>;
  executionTrace?: SpecialistMessage["executionTrace"];
  messages?: SpecialistMessage[];
};
