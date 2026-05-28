"use client";

import type { LocalChatMessage, SendLocalMessageInput, SpecialistId } from "../types";
import {
  MAIN_ASSISTANT_KIND,
  buildMainAssistantInstanceId,
  buildSpecialistInstanceId,
  canonicalAgentKind,
} from "@dude/sdk/runner";
import { GATEWAY_USER_ID } from "@dude/chat/lib/gateway-session";
import type { StoredState } from "./local-chat-storage";
import { createId, getThread, readState, writeState } from "./local-chat-storage";

declare global {
  interface Window {
    dudeDesktop?: {
      isDesktop: boolean;
      platform: string;
      localData?: {
        info: () => Promise<{ path: string }>;
        readState: () => Promise<Partial<StoredState>>;
        writeState: (state: StoredState) => Promise<{ ok: boolean }>;
      };
      gateway?: {
        info: () => Promise<{ url: string | null; running: boolean }>;
        request: (request: {
          path: string;
          method?: string;
          headers?: Record<string, string>;
          body?: unknown;
          timeoutMs?: number;
        }) => Promise<{
          ok: boolean;
          status: number;
          data: unknown;
        }>;
        stream?: (
          request: {
            path: string;
            method?: string;
            headers?: Record<string, string>;
            timeoutMs?: number;
            streamId: string;
          },
          onChunk: (chunk: string) => void,
        ) => Promise<{
          ok: boolean;
          status: number;
          data: unknown;
        }>;
      };
      windowControls?: {
        minimize: () => Promise<{ ok: boolean }>;
        maximize: () => Promise<{ ok: boolean; maximized?: boolean }>;
        close: () => Promise<{ ok: boolean }>;
      };
    };
  }
}

export function isDesktopApp() {
  return Boolean(typeof window !== "undefined" && window.dudeDesktop?.isDesktop);
}

export function hasDesktopGateway() {
  return Boolean(
    typeof window !== "undefined" &&
      window.dudeDesktop?.isDesktop &&
      window.dudeDesktop.gateway?.request,
  );
}

/** True when chat can reach `/v1` (Electron IPC bridge or browser dev/proxy). */
export function canUseGateway() {
  if (hasDesktopGateway()) return true;
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV) return true;
  return Boolean(import.meta.env.VITE_GATEWAY_API_KEY);
}

export function gatewaySpecialistId(specialistId: SpecialistId) {
  return canonicalAgentKind(specialistId);
}

export function gatewayWorkspaceId(
  specialistId: SpecialistId,
  workspaceId?: string,
) {
  const kind = gatewaySpecialistId(specialistId);
  const scopeId = workspaceId ?? GATEWAY_USER_ID;

  if (kind === MAIN_ASSISTANT_KIND) {
    return buildMainAssistantInstanceId(scopeId);
  }

  return buildSpecialistInstanceId(kind, scopeId);
}

export async function gatewayRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const bridge = window.dudeDesktop?.gateway;
  if (bridge) {
    const response = await bridge.request({
      path,
      method: options.method,
      body: options.body,
      timeoutMs: options.timeoutMs,
      headers: {
        "x-user-id": GATEWAY_USER_ID,
      },
    });
    if (!response.ok) {
      const message =
        response.data &&
        typeof response.data === "object" &&
        "error" in response.data
          ? String((response.data as { error?: unknown }).error)
          : `Gateway request failed (${response.status})`;
      throw new Error(message);
    }
    return response.data as T;
  }

  const response = await fetch(`/v1${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": GATEWAY_USER_ID,
      ...(import.meta.env.VITE_GATEWAY_API_KEY
        ? { Authorization: `Bearer ${import.meta.env.VITE_GATEWAY_API_KEY}` }
        : {}),
    },
    body:
      options.method && options.method !== "GET" && options.method !== "DELETE"
        ? JSON.stringify(options.body ?? {})
        : undefined,
    signal: options.timeoutMs
      ? AbortSignal.timeout(options.timeoutMs)
      : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const apiError =
      data &&
      typeof data === "object" &&
      "error" in data &&
      (data as { error?: unknown }).error
        ? String((data as { error?: unknown }).error)
        : "";
    const message = apiError
      ? apiError
      : response.status === 500
        ? "Gateway request failed (500). The local API is not running or failed to start — run `npm run dev` and confirm [dude-server] listening on :8787. If you use `npm run dev -w @dude/api` directly, run `npm run rebuild:sqlite:node` first."
        : `Gateway request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function gatewayStreamRequest(
  path: string,
  onChunk: (chunk: string) => void,
  options: { timeoutMs?: number } = {},
): Promise<void> {
  const bridge = window.dudeDesktop?.gateway;
  const timeoutMs = options.timeoutMs;
  const headers = {
    "x-user-id": GATEWAY_USER_ID,
    Accept: "text/event-stream",
  };

  if (bridge?.stream) {
    const streamId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `stream-${Date.now()}`;
    const response = await bridge.stream(
      {
        path,
        method: "GET",
        headers,
        timeoutMs,
        streamId,
      },
      onChunk,
    );
    if (!response.ok) {
      const message =
        response.data &&
        typeof response.data === "object" &&
        "error" in response.data
          ? String((response.data as { error?: unknown }).error)
          : `Gateway stream failed (${response.status})`;
      throw new Error(message);
    }
    return;
  }

  const response = await fetch(`/v1${path}`, {
    method: "GET",
    headers: {
      ...headers,
      ...(import.meta.env.VITE_GATEWAY_API_KEY
        ? { Authorization: `Bearer ${import.meta.env.VITE_GATEWAY_API_KEY}` }
        : {}),
    },
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: unknown }).error)
        : `Gateway stream failed (${response.status})`;
    throw new Error(message);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Gateway stream returned no body");
  }

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
  const trailing = decoder.decode();
  if (trailing) onChunk(trailing);
}

export async function appendUserMessageToThread(
  input: SendLocalMessageInput,
  userMessage: LocalChatMessage,
) {
  const state = await readState();
  const messages = getThread(
    state,
    input.specialistId,
    input.workspaceId,
  );
  if (!messages.some((message) => message.id === userMessage.id)) {
    messages.push(userMessage);
  }
  await writeState(state);
  return userMessage;
}

export async function appendMessagePair(
  input: SendLocalMessageInput,
  userMessage: LocalChatMessage,
  assistantMessage: LocalChatMessage,
) {
  const state = await readState();
  const messages = getThread(
    state,
    input.specialistId,
    input.workspaceId,
  );
  const existingIds = new Set(messages.map((message) => message.id));
  if (!existingIds.has(userMessage.id)) messages.push(userMessage);
  const assistantIndex = messages.findIndex(
    (message) =>
      message.role === "assistant" &&
      message.id.startsWith("pending-assistant-"),
  );
  if (assistantIndex >= 0) {
    messages.splice(assistantIndex, 1);
  }
  if (!existingIds.has(assistantMessage.id)) messages.push(assistantMessage);
  await writeState(state);
  return { userMessage, assistantMessage };
}
