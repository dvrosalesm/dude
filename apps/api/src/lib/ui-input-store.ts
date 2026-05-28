import { randomUUID } from "node:crypto";
import type {
  CreateUiInputRequest,
  UiInputRequestPublic,
  UiInputResponse,
} from "./ui-input-types.js";

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

type PendingEntry = {
  request: UiInputRequestPublic;
  resolve: (response: UiInputResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const pendingById = new Map<string, PendingEntry>();
const pendingByWorkspace = new Map<string, string>();

export type UiInputRequestListener = (
  workspaceId: string,
  request: UiInputRequestPublic,
) => void;

let requestListener: UiInputRequestListener | null = null;

export function setUiInputRequestListener(listener: UiInputRequestListener | null) {
  requestListener = listener;
}

function toPublicRequest(input: CreateUiInputRequest): UiInputRequestPublic {
  return {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    kind: input.kind,
    title: input.title.trim(),
    message: input.message.trim(),
    options: input.options?.length ? input.options : undefined,
    defaultOptionId: input.defaultOptionId,
    placeholder: input.placeholder,
    createdAt: new Date().toISOString(),
  };
}

export function getPendingUiInput(
  workspaceId: string,
): UiInputRequestPublic | null {
  const requestId = pendingByWorkspace.get(workspaceId);
  if (!requestId) return null;
  return pendingById.get(requestId)?.request ?? null;
}

export function waitForUiInput(
  input: CreateUiInputRequest,
  options: { timeoutMs?: number } = {},
): Promise<UiInputResponse> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const existingId = pendingByWorkspace.get(input.workspaceId);
  if (existingId) {
    return Promise.reject(
      new Error(
        "Another input request is already waiting for this workspace. Resolve it first.",
      ),
    );
  }

  const request = toPublicRequest(input);

  return new Promise<UiInputResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanupRequest(request.id);
      reject(new Error("Timed out waiting for user input"));
    }, timeoutMs);

    pendingById.set(request.id, { request, resolve, reject, timer });
    pendingByWorkspace.set(input.workspaceId, request.id);
    requestListener?.(input.workspaceId, request);
  });
}

function cleanupRequest(requestId: string) {
  const entry = pendingById.get(requestId);
  if (!entry) return;
  clearTimeout(entry.timer);
  pendingById.delete(requestId);
  if (pendingByWorkspace.get(entry.request.workspaceId) === requestId) {
    pendingByWorkspace.delete(entry.request.workspaceId);
  }
}

export function resolveUiInputRequest(
  requestId: string,
  response: UiInputResponse,
): boolean {
  const entry = pendingById.get(requestId);
  if (!entry) return false;
  cleanupRequest(requestId);
  entry.resolve(response);
  return true;
}

export function cancelUiInputForWorkspace(
  workspaceId: string,
  reason = "Run ended before the user responded",
): boolean {
  const requestId = pendingByWorkspace.get(workspaceId);
  if (!requestId) return false;
  const entry = pendingById.get(requestId);
  if (!entry) return false;
  cleanupRequest(requestId);
  entry.reject(new Error(reason));
  return true;
}
