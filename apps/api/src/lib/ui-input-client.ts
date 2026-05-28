/**
 * Internal HTTP client for runners (Codex, Hermes, …) to block on UI input.
 */

import type {
  CreateUiInputRequest,
  UiInputResponse,
} from "./ui-input-types.js";
import { resolveMainApiPort } from "./runner-session-manifest.js";

function internalPort(): string {
  return resolveMainApiPort();
}

export async function waitForUiInputRemote(
  workspaceId: string,
  request: Omit<CreateUiInputRequest, "workspaceId">,
): Promise<UiInputResponse> {
  const url = `http://127.0.0.1:${internalPort()}/v1/internal/workspace/${encodeURIComponent(workspaceId)}/ui-input/wait`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, workspaceId }),
    signal: AbortSignal.timeout(30 * 60 * 1000),
  });

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text || "{}") as Record<string, unknown>;
  } catch {
    throw new Error(`UI input wait returned invalid JSON: ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    const message =
      typeof parsed.error === "string"
        ? parsed.error
        : `UI input wait failed (${res.status})`;
    throw new Error(message);
  }

  return parsed as unknown as UiInputResponse;
}
