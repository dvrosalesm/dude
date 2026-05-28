import type { LucideIcon } from "lucide-react";
import type {
  ChatImageAttachment,
  ExecutionTrace,
  FileReference,
  SpecialistMessage,
} from "./types";
import type { UiInputPromptRequest } from "./ui-input-prompt";

export type SpecialistChatProps = {
  messages: SpecialistMessage[];
  newMessage: string;
  onMessageChange: (value: string) => void;
  onSend: (messageOverride?: string) => void;
  onStop?: () => void;
  canSend: boolean;
  sending: boolean;
  sendError?: string | null;
  attachments: ChatImageAttachment[];
  onAttachImages: (
    files: File[],
    source?: "picker" | "clipboard",
  ) => Promise<void> | void;
  onRemoveImage: (id: string) => void;
  executionTraces?: ExecutionTrace[];
  progressMessages?: string[];
  wakingUp?: boolean;
  wakingUpLabel?: string;
  placeholder?: string;
  toolIcons?: Record<string, LucideIcon>;
  argPreview?: (tool: string, args: Record<string, unknown>) => string;
  inputLayout?: "floating" | "docked";
  fileReferences?: FileReference[];
  onAddFileReference?: (ref: FileReference) => void;
  onRemoveFileReference?: (id: string) => void;
  onClearChat?: () => void;
  onSaveReport?: (spec: Record<string, unknown>) => void;
  messagesCollapsed?: boolean;
  extraInputControls?: React.ReactNode;
  onPinMessage?: (messageId: string, pinned: boolean) => void;
  hasMoreMessages?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  onEditImage?: (src: string) => void;
  inputMaxWidthClass?: string;
  inputVariant?: "bar" | "open";
  inputPlaceholderStyle?: "default" | "scribble";
  messagesPrependContent?: React.ReactNode;
  wrapperLayout?: "fill" | "auto";
  recovering?: boolean;
  onInterceptFiles?: (files: File[]) => boolean;
  onSuggestionAction?: (action: string, args: string[]) => void;
  historyLayout?: "bubbles" | "workspace" | "stage";
  workspaceHome?: React.ReactNode;
  pendingUiInput?: UiInputPromptRequest | null;
  onRespondUiInput?: (response: {
    action: "submit" | "cancel";
    confirmed?: boolean;
    value?: string;
    selectedOptionId?: string;
  }) => void | Promise<void>;
  projectHub?: React.ReactNode;
};
