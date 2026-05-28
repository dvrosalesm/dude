import type {
  LocalChatMessage,
  LocalSpecialistWorkspace,
  SpecialistId,
  UiInputResponsePayload,
} from "@dude/client-types";

import {
  chatRuntime,
  requireMatchingWorkspace,
  toUiMessage,
} from "./shared";
import { buildSendMessageInput } from "./gateway-payload";

export type AssistantProgressUpdate = {
  pendingUserInput?: unknown;
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
};

export type AssistantRunOptions = {
  onProgress?: (update: AssistantProgressUpdate) => void;
};

type AssistantJobResult = {
  type: string;
  answer: string;
  steps: string[];
  suggestions?: string[];
  gatewaySessionId?: string;
};

function buildAssistantJobResult(
  answer: string,
  gatewaySessionId?: string,
  suggestions?: string[],
  steps: string[] = [],
): AssistantJobResult {
  return {
    type: "final",
    answer,
    steps,
    suggestions,
    gatewaySessionId,
  };
}

export type AssistantExecutionTrace = NonNullable<
  AssistantProgressUpdate["executionTraces"]
>[number];

function executionTraceFromAssistantMessage(
  message: LocalChatMessage,
  durationMs: number,
): AssistantExecutionTrace {
  if (message.executionTrace) {
    return {
      ...message.executionTrace,
      durationMs: message.executionTrace.durationMs || durationMs,
    };
  }
  return {
    id: message.id,
    timestamp: message.createdAt,
    steps: [],
    toolExecutions: [],
    durationMs,
  };
}

async function sendAssistantMessage(
  specialistId: SpecialistId,
  workspaceId: string,
  body: Record<string, unknown> = {},
  options?: AssistantRunOptions,
) {
  const workspace = await requireMatchingWorkspace(specialistId, workspaceId);
  const sendInput = buildSendMessageInput(workspace.specialistId, workspace.id, body);
  sendInput.onProgress = options?.onProgress;
  const result = await chatRuntime.sendMessage(sendInput);
  const durationMs = Date.now();
  const executionTrace = executionTraceFromAssistantMessage(
    result.assistantMessage,
    durationMs,
  );

  const jobResult = buildAssistantJobResult(
    result.assistantMessage.content,
    result.gatewaySessionId,
    result.assistantMessage.suggestions,
    executionTrace.steps,
  );

  return {
    jobResult,
    messages: [result.userMessage, result.assistantMessage].map(toUiMessage),
    assistantMessage: toUiMessage(result.assistantMessage),
    sessionId: result.gatewaySessionId,
    executionTrace,
    progressMessages: result.assistantMessage.progressMessages,
  };
}

export async function resumeAssistantIfActive(
  specialistId: SpecialistId,
  workspaceId: string,
) {
  if (!chatRuntime.resumeActiveTurn) {
    return { active: false as const, reattaching: false as const };
  }
  return chatRuntime.resumeActiveTurn(specialistId, workspaceId);
}

export function abandonAssistantTurn(
  specialistId: SpecialistId,
  workspaceId: string,
) {
  chatRuntime.abandonActiveTurn?.(specialistId, workspaceId);
}

export async function reloadAssistantMessages(
  specialistId: SpecialistId,
  workspaceId: string,
) {
  const messages = await chatRuntime.listMessages(specialistId, workspaceId);
  return messages.map(toUiMessage);
}

export async function clearAssistant(specialistId: SpecialistId, workspaceId: string) {
  await chatRuntime.clearThread(specialistId, workspaceId);
  return { ok: true as const };
}

export async function respondAssistantUiInput(
  workspaceId: string,
  requestId: string,
  response: UiInputResponsePayload,
) {
  await chatRuntime.respondUiInput(workspaceId, requestId, response);
}

export async function runAssistantMessage(
  specialistId: SpecialistId,
  workspaceId: string,
  body: Record<string, unknown> = {},
  options?: AssistantRunOptions,
) {
  const startTime = Date.now();
  const { jobResult, messages, assistantMessage, sessionId, executionTrace } =
    await sendAssistantMessage(specialistId, workspaceId, body, options);
  const durationMs = Date.now() - startTime;
  const trace: AssistantExecutionTrace = {
    ...executionTrace,
    durationMs: executionTrace.durationMs || durationMs,
  };

  return {
    type: jobResult.type,
    answer: jobResult.answer,
    steps: trace.steps,
    suggestions: jobResult.suggestions,
    gatewaySessionId: jobResult.gatewaySessionId ?? sessionId,
    messages,
    assistantMessage,
    sessionId,
    executionTrace: trace,
    pendingEdits: [] as unknown[],
  };
}
