/**
 * Shared types for runner → UI input requests (confirmations, questions, choices).
 */

export type UiInputKind = "confirm" | "question" | "choice";

export interface UiInputOption {
  id: string;
  label: string;
}

/** Payload exposed to the client while a request is pending. */
export interface UiInputRequestPublic {
  id: string;
  workspaceId: string;
  kind: UiInputKind;
  title: string;
  message: string;
  options?: UiInputOption[];
  defaultOptionId?: string;
  placeholder?: string;
  createdAt: string;
}

export interface UiInputResponse {
  action: "submit" | "cancel";
  confirmed?: boolean;
  value?: string;
  selectedOptionId?: string;
}

export interface CreateUiInputRequest {
  workspaceId: string;
  kind: UiInputKind;
  title: string;
  message: string;
  options?: UiInputOption[];
  defaultOptionId?: string;
  placeholder?: string;
  toolCallId?: string;
  source?: string;
}
