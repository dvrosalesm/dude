"use client";

import type { LocalChatMessage, ProjectHubSnapshot, SendLocalMessageInput, SpecialistId } from "../types";
import {
  clearGatewaySessionId,
  readGatewaySessionId,
  writeGatewaySessionId,
} from "@dude/chat/lib/gateway-session";
import { createId, specialistName, threadKey } from "./local-chat-storage";
import { resolveChatScopeId } from "./chat-scope";
import {
  gatewayRequest,
  gatewaySpecialistId,
  gatewayStreamRequest,
  gatewayWorkspaceId,
  canUseGateway,
} from "./gateway-desktop";
import { buildGatewayConfig } from "./gateway-prompts";
import {
  applyLocalAppConfigurationRequests,
  readLocalGtSession,
} from "./gateway-app-config";
import type { GatewayChatResponse, GatewayConversationMessage } from "./gateway-types";
import { AGENT_CHAT_TURN_TIMEOUT_MS } from "@dude/sdk/runner";
import { extractUserFacingMessage } from "@dude/gateway-shared/user-facing-message";
import { getThread, inferSpecialist, readState } from "./local-chat-storage";
import { SPECIALISTS } from "./specialist-list";
import type { LocalChatExecutionTrace, LocalChatMessage } from "../types";
import {
  appendGatewayUserMessage,
  startGatewayTurnCompletion,
  type PendingGatewayTurn,
} from "./gateway-pending-turns";

function executionTraceFromGatewayMessage(
  message: GatewayConversationMessage,
): LocalChatExecutionTrace | undefined {
  if (!message.traces) return undefined;
  return {
    id: message.id,
    timestamp: message.createdAt,
    steps: message.traces.steps ?? [],
    toolExecutions: message.traces.toolExecutions ?? [],
    durationMs: message.traces.durationMs ?? 0,
  };
}

export function mapGatewayMessage(
  message: GatewayConversationMessage,
  specialistId: SpecialistId,
): LocalChatMessage {
  return {
    id: message.id,
    role: message.role,
    specialistId,
    createdAt: message.createdAt,
    content:
      message.status === "error"
        ? message.error || "Gateway run failed"
        : message.content,
    images: message.images,
    suggestions: message.suggestions,
    pendingUserInput: message.pendingUserInput ?? null,
    executionTrace: executionTraceFromGatewayMessage(message),
    progressMessages: message.progressMessages?.length
      ? message.progressMessages
      : undefined,
  };
}

export async function respondGatewayUiInput(
  workspaceId: string,
  requestId: string,
  response: {
    action: "submit" | "cancel";
    confirmed?: boolean;
    value?: string;
    selectedOptionId?: string;
  },
) {
  await gatewayRequest(
    `/instances/${encodeURIComponent(workspaceId)}/ui-input/${encodeURIComponent(requestId)}/respond`,
    {
      method: "POST",
      body: response,
      timeoutMs: 30_000,
    },
  );
}

async function ensureGatewayInstance(
  specialistId: SpecialistId,
  workspaceIdOverride?: string,
) {
  const workspaceId = gatewayWorkspaceId(
    specialistId,
    workspaceIdOverride,
  );
  const scopeId = workspaceIdOverride?.trim();
  const state = scopeId ? await readState() : null;
  const snapshot =
    scopeId && state?.workspaces[scopeId]
      ? {
          id: state.workspaces[scopeId].id,
          specialistId: state.workspaces[scopeId].specialistId,
          name: state.workspaces[scopeId].name,
          status: state.workspaces[scopeId].status,
          configurations: state.workspaces[scopeId].configurations,
        }
      : undefined;

  await gatewayRequest("/instances", {
    method: "POST",
    timeoutMs: 120_000,
    body: {
      workspaceId,
      specialistId: gatewaySpecialistId(specialistId),
      config: buildGatewayConfig(specialistId),
      ...(snapshot ? { workspaceSnapshot: snapshot } : {}),
    },
  });
  return workspaceId;
}

function parseSsePart(
  part: string,
  onEvent: (eventType: string, data: unknown) => void,
): void {
  if (!part.trim() || part.startsWith(":")) return;
  let eventType = "";
  let eventData = "";
  for (const line of part.split("\n")) {
    if (line.startsWith("event: ")) eventType = line.slice(7).trim();
    else if (line.startsWith("data: ")) eventData = line.slice(6);
  }
  if (!eventType || !eventData) return;
  onEvent(eventType, JSON.parse(eventData));
}

function parseSseChunk(
  buffer: string,
  onEvent: (eventType: string, data: unknown) => void,
): string {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() || "";

  for (const part of parts) {
    parseSsePart(part, onEvent);
  }

  return remainder;
}

function flushSseBuffer(
  buffer: string,
  onEvent: (eventType: string, data: unknown) => void,
): void {
  if (!buffer.trim()) return;
  parseSsePart(buffer, onEvent);
}

const STREAM_DONE_RECOVERY_MS = 30_000;
const STREAM_DONE_POLL_MS = 1_000;

async function recoverGatewayTurnMessages(
  workspaceId: string,
  sessionId: string,
  assistantMessageId: string,
): Promise<GatewayConversationMessage[] | null> {
  const deadline = Date.now() + STREAM_DONE_RECOVERY_MS;

  while (Date.now() < deadline) {
    const data = await gatewayRequest<{ messages?: GatewayConversationMessage[] }>(
      `/instances/${encodeURIComponent(workspaceId)}/chat?sessionId=${encodeURIComponent(sessionId)}`,
      { method: "GET", timeoutMs: 30_000 },
    );
    const assistant = data.messages?.find(
      (message) => message.id === assistantMessageId,
    );
    if (assistant && assistant.status !== "processing") {
      return data.messages ?? [];
    }
    await new Promise((resolve) => setTimeout(resolve, STREAM_DONE_POLL_MS));
  }

  return null;
}

export async function streamGatewayChatTurn(
  workspaceId: string,
  sessionId: string,
  assistantMessageId: string,
  specialistId: SpecialistId,
  onProgress?: SendLocalMessageInput["onProgress"],
): Promise<GatewayConversationMessage[]> {
  const path = `/instances/${encodeURIComponent(workspaceId)}/chat/stream?sessionId=${encodeURIComponent(sessionId)}&messageId=${encodeURIComponent(assistantMessageId)}`;
  let buffer = "";
  let doneMessages: GatewayConversationMessage[] | null = null;
  let streamError: Error | null = null;

  const handleSseEvent = (eventType: string, data: unknown) => {
    if (eventType === "progress") {
      onProgress?.(
        data as NonNullable<
          Parameters<NonNullable<SendLocalMessageInput["onProgress"]>>[0]
        >,
      );
      return;
    }
    if (eventType === "done") {
      const payload = data as {
        status?: string;
        messages?: GatewayConversationMessage[];
        error?: string;
      };
      doneMessages = payload.messages ?? null;
      if (payload.status === "error") {
        const failedAssistant = [...(doneMessages ?? [])]
          .reverse()
          .find((message) => message.role === "assistant");
        streamError = new Error(
          failedAssistant?.error || payload.error || "Gateway run failed",
        );
      }
    }
  };

  await gatewayStreamRequest(
    path,
    (chunk) => {
      buffer += chunk;
      try {
        buffer = parseSseChunk(buffer, handleSseEvent);
      } catch (error) {
        streamError =
          error instanceof Error ? error : new Error(String(error));
      }
    },
    { timeoutMs: AGENT_CHAT_TURN_TIMEOUT_MS },
  );

  if (!streamError) {
    try {
      flushSseBuffer(buffer, handleSseEvent);
    } catch (error) {
      streamError =
        error instanceof Error ? error : new Error(String(error));
    }
  }

  if (streamError) throw streamError;
  if (!doneMessages) {
    const recovered = await recoverGatewayTurnMessages(
      workspaceId,
      sessionId,
      assistantMessageId,
    );
    if (recovered) {
      return recovered;
    }
    throw new Error("Gateway stream ended without a done event");
  }

  return doneMessages;
}

export async function sendGatewayMessage(
  input: SendLocalMessageInput,
): Promise<{
  userMessage: LocalChatMessage;
  assistantMessage: LocalChatMessage;
  gatewaySessionId: string;
}> {
  const workspaceId = await ensureGatewayInstance(
    input.specialistId,
    input.workspaceId,
  );
  const existingSessionId =
    input.gatewaySessionId ??
    readGatewaySessionId(input.specialistId, input.workspaceId);
  const previousGtSession =
    input.specialistId === "main-assistant"
      ? await readLocalGtSession(workspaceId)
      : null;

  const data = await gatewayRequest<GatewayChatResponse>(
    `/instances/${encodeURIComponent(workspaceId)}/chat`,
    {
      method: "POST",
      timeoutMs: 60_000,
      body: {
        message: input.content,
        displayMessage:
          input.displayContent?.trim() ||
          extractUserFacingMessage(input.content),
        sessionId: existingSessionId,
        history: input.history,
        images: input.images,
        files: input.files,
      },
    },
  );
  writeGatewaySessionId(
    input.specialistId,
    data.sessionId,
    input.workspaceId,
  );

  const assistantMessageId =
    data.assistantMessageId ??
    [...data.messages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" && message.status === "processing",
      )?.id;

  if (!assistantMessageId) {
    throw new Error("Gateway did not return an assistant message id");
  }

  const gatewayUser = [...data.messages]
    .reverse()
    .find((message) => message.role === "user" && message.status === "completed");
  if (!gatewayUser) {
    throw new Error("Gateway did not return a user message");
  }

  const scopedWorkspaceId = resolveChatScopeId(
    input.specialistId,
    input.workspaceId,
  );

  const userFacingContent =
    input.displayContent?.trim() ||
    extractUserFacingMessage(gatewayUser.content);

  const persistedUser = await appendGatewayUserMessage(
    input,
    gatewayUser,
    userFacingContent,
  );

  const pendingTurn: PendingGatewayTurn = {
    specialistId: input.specialistId,
    workspaceId: scopedWorkspaceId,
    gtWorkspaceId: workspaceId,
    sessionId: data.sessionId,
    assistantMessageId,
  };

  await startGatewayTurnCompletion(pendingTurn, input, {
    onProgress: input.onProgress,
    displayContent: userFacingContent,
  });

  const state = await readState();
  const thread = getThread(state, input.specialistId, input.workspaceId);
  const assistantMessage =
    [...thread]
      .reverse()
      .find((message) => message.role === "assistant") ??
    ({
      id: assistantMessageId,
      role: "assistant" as const,
      specialistId: input.specialistId,
      createdAt: new Date().toISOString(),
      content: "",
    } satisfies LocalChatMessage);

  const setupSummary =
    input.specialistId === "main-assistant"
      ? await applyLocalAppConfigurationRequests(workspaceId, previousGtSession)
      : null;

  return {
    userMessage: persistedUser,
    assistantMessage: {
      ...assistantMessage,
      content: `${assistantMessage.content}${setupSummary ?? ""}`,
    },
    gatewaySessionId: data.sessionId,
  };
}

export function createSuggestions(input: SendLocalMessageInput): string[] | undefined {
  if (input.specialistId !== "main-assistant") return undefined;
  const selected = inferSpecialist(input.content);
  if (!selected) {
    return ["Show specialist options", "Set up local API keys"];
  }
  return [`Open ${selected.name}`, "Set up local API keys"];
}

export async function fetchProjectHubSnapshot(
  specialistId: SpecialistId,
  workspaceId?: string,
): Promise<ProjectHubSnapshot | null> {
  if (!canUseGateway()) return null;
  const gtWorkspaceId = gatewayWorkspaceId(specialistId, workspaceId);
  try {
    return await gatewayRequest<ProjectHubSnapshot>(
      "/internal/assistant/project-hub",
      {
        method: "POST",
        body: { gtWorkspaceId },
        timeoutMs: 30_000,
      },
    );
  } catch {
    return null;
  }
}
