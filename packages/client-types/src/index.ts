export type SpecialistId =
  | "main-assistant"
  | "data-analyst"
  | "document-writer"
  | "presentation-editor"
  | "design-branding"
  | "prospect";

export type LocalChatRole = "assistant" | "user";

export interface LocalChatExecutionTrace {
  id: string;
  timestamp: string;
  steps: string[];
  toolExecutions: Array<{
    tool: string;
    arguments: Record<string, unknown>;
    result: unknown;
  }>;
  durationMs: number;
}

export interface LocalChatMessage {
  id: string;
  role: LocalChatRole;
  content: string;
  /** User-visible text when `content` includes hidden workspace context. */
  displayContent?: string;
  createdAt: string;
  specialistId: SpecialistId;
  pinned?: boolean;
  images?: string[];
  files?: Array<{ name: string; mimeType: string }>;
  suggestions?: string[];
  pendingUserInput?: UiInputRequestPublic | null;
  executionTrace?: LocalChatExecutionTrace;
  progressMessages?: string[];
}

export type UiInputKind = "confirm" | "question" | "choice";

export interface UiInputRequestPublic {
  id: string;
  workspaceId: string;
  kind: UiInputKind;
  title: string;
  message: string;
  options?: Array<{ id: string; label: string }>;
  defaultOptionId?: string;
  placeholder?: string;
  createdAt: string;
}

export interface UiInputResponsePayload {
  action: "submit" | "cancel";
  confirmed?: boolean;
  value?: string;
  selectedOptionId?: string;
}

export interface ProjectArtifactSummary {
  collection: string;
  label: string;
  kind: "singleton" | "array";
  count?: number;
  preview?: string;
}

export interface ProjectAgentCard {
  specialistId: string;
  workspaceId: string;
  workspaceName: string;
  lastInvokedAt?: string;
  lastTask?: string;
  lastAnswer?: string;
  messageCount: number;
  recentMessages: Array<{ role: string; content: string; createdAt: string }>;
  artifacts: ProjectArtifactSummary[];
  suggestions: string[];
}

export interface ProjectHubSnapshot {
  gtWorkspaceId: string;
  projectName?: string;
  updatedAt?: string;
  agents: ProjectAgentCard[];
  suggestions: string[];
}

export interface SpecialistSummary {
  id: SpecialistId;
  name: string;
  handle: string;
  scope: string;
  status: "ready" | "draft";
}

export interface LocalSpecialistWorkspace {
  id: string;
  specialistId: SpecialistId;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "active";
  configurations: Record<string, unknown>;
}

export interface LocalStoredFile {
  id: string;
  fileName: string;
  fileType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  text?: string;
  bytesBase64?: string;
  dataUrl?: string;
  source?: string;
}

export interface GatewayHistoryMessage {
  role: string;
  content: string;
}

export interface SendLocalMessageInput {
  specialistId: SpecialistId;
  workspaceId?: string;
  content: string;
  /** User-visible chat text — omit when identical to `content`. */
  displayContent?: string;
  history?: GatewayHistoryMessage[];
  gatewaySessionId?: string;
  images?: string[];
  files?: Array<{ name: string; mimeType: string }>;
  onProgress?: (update: {
    pendingUserInput?: UiInputRequestPublic | null;
    executionTraces?: Array<{
      id: string;
      timestamp: string;
      steps: string[];
      toolExecutions: Array<{
        tool: string;
        arguments: Record<string, unknown>;
        result: unknown;
      }>;
      durationMs: number;
    }>;
    partialAssistantContent?: string;
    progressMessages?: string[];
  }) => void;
}

export interface SendLocalMessageResult {
  userMessage: LocalChatMessage;
  assistantMessage: LocalChatMessage;
  gatewaySessionId?: string;
}

export interface LocalChatRuntime {
  listWorkspaces(
    specialistId: SpecialistId,
  ): Promise<LocalSpecialistWorkspace[]>;
  getWorkspace(workspaceId: string): Promise<LocalSpecialistWorkspace | null>;
  createWorkspace(input: {
    specialistId: SpecialistId;
    name?: string;
    configurations?: Record<string, unknown>;
  }): Promise<LocalSpecialistWorkspace>;
  updateWorkspace(
    workspaceId: string,
    updates: Partial<
      Pick<LocalSpecialistWorkspace, "name" | "status" | "configurations">
    >,
  ): Promise<LocalSpecialistWorkspace | null>;
  deleteWorkspace(workspaceId: string): Promise<boolean>;
  listMessages(
    specialistId: SpecialistId,
    workspaceId?: string,
  ): Promise<LocalChatMessage[]>;
  sendMessage(input: SendLocalMessageInput): Promise<SendLocalMessageResult>;
  respondUiInput(
    workspaceId: string,
    requestId: string,
    response: UiInputResponsePayload,
  ): Promise<void>;
  clearThread(
    specialistId: SpecialistId,
    workspaceId?: string,
  ): Promise<LocalChatMessage[]>;
  saveFile(
    file: Omit<LocalStoredFile, "createdAt" | "updatedAt"> &
      Partial<Pick<LocalStoredFile, "createdAt" | "updatedAt">>,
  ): Promise<LocalStoredFile>;
  getFile(fileId: string): Promise<LocalStoredFile | null>;
  deleteFile(fileId: string): Promise<boolean>;
  fetchProjectHub?(
    specialistId: SpecialistId,
    workspaceId?: string,
  ): Promise<ProjectHubSnapshot | null>;
  /** Re-attach to an in-flight gateway turn after navigating away. */
  resumeActiveTurn?(
    specialistId: SpecialistId,
    workspaceId: string,
  ): Promise<{
    active: boolean;
    promise?: Promise<void>;
    reattaching?: boolean;
  }>;
  /** Drop client-side gateway stream state after the user stops a turn. */
  abandonActiveTurn?(
    specialistId: SpecialistId,
    workspaceId?: string,
  ): void;
}
