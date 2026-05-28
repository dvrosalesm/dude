import { httpError } from "../http-error.js";
import {
  getPendingUiInput,
  resolveUiInputRequest,
  waitForUiInput,
} from "../../lib/ui-input-store.js";
import type {
  CreateUiInputRequest,
  UiInputKind,
  UiInputOption,
  UiInputResponse,
} from "../../lib/ui-input-types.js";

function asKind(value: unknown): UiInputKind {
  if (value === "confirm" || value === "question" || value === "choice") {
    return value;
  }
  throw httpError('kind must be "confirm", "question", or "choice"', 400);
}

function parseOptions(value: unknown): UiInputOption[] | undefined {
  if (!Array.isArray(value) || !value.length) return undefined;
  const options = value
    .map((entry): UiInputOption | null => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id.trim() : "";
      const label = typeof row.label === "string" ? row.label.trim() : "";
      if (!id || !label) return null;
      return { id, label };
    })
    .filter((entry): entry is UiInputOption => entry !== null);
  return options.length ? options : undefined;
}

function parseCreateRequest(
  workspaceId: string,
  body: Record<string, unknown>,
): CreateUiInputRequest {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!title || !message) {
    throw httpError("title and message are required", 400);
  }

  const kind = asKind(body.kind);
  const options = parseOptions(body.options);

  if (kind === "choice" && (!options || options.length < 2)) {
    throw httpError("choice requests require at least two options", 400);
  }

  return {
    workspaceId,
    kind,
    title,
    message,
    options,
    defaultOptionId:
      typeof body.defaultOptionId === "string"
        ? body.defaultOptionId
        : typeof body.default_option_id === "string"
          ? body.default_option_id
          : undefined,
    placeholder:
      typeof body.placeholder === "string" ? body.placeholder : undefined,
    toolCallId:
      typeof body.toolCallId === "string" ? body.toolCallId : undefined,
    source: typeof body.source === "string" ? body.source : undefined,
  };
}

function parseResponse(body: Record<string, unknown>): UiInputResponse {
  const action = body.action === "cancel" ? "cancel" : "submit";
  return {
    action,
    confirmed:
      typeof body.confirmed === "boolean" ? body.confirmed : undefined,
    value: typeof body.value === "string" ? body.value : undefined,
    selectedOptionId:
      typeof body.selectedOptionId === "string"
        ? body.selectedOptionId
        : typeof body.selected_option_id === "string"
          ? body.selected_option_id
          : undefined,
  };
}

export async function waitForWorkspaceUiInput(
  workspaceId: string,
  body: Record<string, unknown>,
) {
  const request = parseCreateRequest(workspaceId, body);
  try {
    const response = await waitForUiInput(request);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw httpError(message, 408);
  }
}

export async function respondToUiInput(
  requestId: string,
  body: Record<string, unknown>,
) {
  const response = parseResponse(body);
  const ok = resolveUiInputRequest(requestId, response);
  if (!ok) {
    throw httpError("Input request not found or already resolved", 404);
  }
  return { ok: true as const };
}

export function readPendingUiInput(workspaceId: string) {
  return { pending: getPendingUiInput(workspaceId) };
}
