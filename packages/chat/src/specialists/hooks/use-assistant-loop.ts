"use client";

/**
 * Shared assistant loop for local workspace chat.
 */

import { useCallback, useRef, useState } from "react";
import {
  respondAssistantUiInput,
  runAssistantMessage,
  type AssistantExecutionTrace,
} from "@dude/workspaces";
import type { UiInputPromptRequest } from "../ui-input-prompt";
import type { ExecutionTrace, SpecialistMessage } from "../types";
import { extractPendingEditsFromTraces } from "./pending-edits";

function toUiInputPromptRequest(
  pending: unknown,
): UiInputPromptRequest | null {
  if (!pending || typeof pending !== "object") return null;
  const row = pending as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.kind !== "string") return null;
  if (typeof row.title !== "string" || typeof row.message !== "string") {
    return null;
  }
  if (
    row.kind !== "confirm" &&
    row.kind !== "question" &&
    row.kind !== "choice"
  ) {
    return null;
  }

  const options = Array.isArray(row.options)
    ? row.options
        .filter(
          (entry): entry is { id: string; label: string } =>
            Boolean(entry) &&
            typeof entry === "object" &&
            typeof (entry as { id?: unknown }).id === "string" &&
            typeof (entry as { label?: unknown }).label === "string",
        )
        .map((entry) => ({ id: entry.id, label: entry.label }))
    : undefined;

  return {
    id: row.id,
    workspaceId:
      typeof row.workspaceId === "string" ? row.workspaceId : undefined,
    kind: row.kind,
    title: row.title,
    message: row.message,
    options: options?.length ? options : undefined,
    defaultOptionId:
      typeof row.defaultOptionId === "string" ? row.defaultOptionId : undefined,
    placeholder:
      typeof row.placeholder === "string" ? row.placeholder : undefined,
  };
}

export type AssistantLoopSendTurnInput = {
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

export type AssistantLoopSendTurnResult = {
  type?: string;
  answer?: string;
  question?: string;
  steps?: string[];
  suggestions?: string[];
  executionTrace?: ExecutionTrace;
  messages?: SpecialistMessage[];
};

export function useAssistantLoop({
  specialistId,
  workspaceId,
  getSessionId,
  saveSessionId,
  extraPayload,
  onPendingEdits,
  sendTurn,
  respondUiInputTurn,
}: {
  specialistId: string;
  workspaceId: string | undefined;
  getSessionId: () => string | undefined;
  saveSessionId: (id: string) => void;
  extraPayload?: () => Record<string, unknown>;
  onPendingEdits?: (edits: unknown[]) => void;
  sendTurn?: (input: AssistantLoopSendTurnInput) => Promise<AssistantLoopSendTurnResult>;
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
}) {
  const [executionTraces, setExecutionTraces] = useState<ExecutionTrace[]>([]);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [pendingUiInput, setPendingUiInput] =
    useState<UiInputPromptRequest | null>(null);

  const extraPayloadRef = useRef(extraPayload);
  extraPayloadRef.current = extraPayload;
  const onPendingEditsRef = useRef(onPendingEdits);
  onPendingEditsRef.current = onPendingEdits;
  const getSessionIdRef = useRef(getSessionId);
  getSessionIdRef.current = getSessionId;
  const saveSessionIdRef = useRef(saveSessionId);
  saveSessionIdRef.current = saveSessionId;
  const sendTurnRef = useRef(sendTurn);
  sendTurnRef.current = sendTurn;
  const respondUiInputTurnRef = useRef(respondUiInputTurn);
  respondUiInputTurnRef.current = respondUiInputTurn;

  const respondUiInput = useCallback(
    async (response: {
      action: "submit" | "cancel";
      confirmed?: boolean;
      value?: string;
      selectedOptionId?: string;
    }) => {
      if (
        respondUiInputTurnRef.current &&
        pendingUiInput?.workspaceId
      ) {
        await respondUiInputTurnRef.current({
          workspaceId: pendingUiInput.workspaceId,
          requestId: pendingUiInput.id,
          response,
        });
        setPendingUiInput(null);
        return;
      }
      if (!pendingUiInput?.workspaceId) {
        throw new Error("Missing gateway workspace for UI input response.");
      }
      await respondAssistantUiInput(
        pendingUiInput.workspaceId,
        pendingUiInput.id,
        response,
      );
      setPendingUiInput(null);
    },
    [pendingUiInput],
  );

  function handleProgressUpdate(
    update: {
      pendingUserInput?: unknown;
      executionTraces?: ExecutionTrace[];
      progressMessages?: string[];
    },
    appliedEditCountRef: { current: number },
    latestLiveTraceRef: { current: ExecutionTrace | null },
  ) {
    setPendingUiInput(toUiInputPromptRequest(update.pendingUserInput));
    if (update.executionTraces?.length) {
      setExecutionTraces(update.executionTraces);
      latestLiveTraceRef.current =
        update.executionTraces[update.executionTraces.length - 1] ?? null;

      const pendingEdits = extractPendingEditsFromTraces(update.executionTraces);
      const editTools = (update.executionTraces ?? []).flatMap((t) =>
        (t.toolExecutions ?? [])
          .filter((e) => e.tool === "edit_document" || e.tool === "edit_presentation")
          .map((e) => ({
            tool: e.tool,
            editArgCount: Array.isArray(e.arguments?.edits) ? e.arguments.edits.length : 0,
          })),
      );
      // #region agent log
      fetch('http://127.0.0.1:7884/ingest/44760fdd-2433-4958-be9a-fbf49e3e279f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'099559'},body:JSON.stringify({sessionId:'099559',location:'use-assistant-loop.ts:progress',message:'progress edit trace',data:{specialistId,pendingEditCount:pendingEdits.length,appliedSoFar:appliedEditCountRef.current,editTools,traceCount:update.executionTraces?.length??0},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (
        pendingEdits.length > appliedEditCountRef.current &&
        onPendingEditsRef.current
      ) {
        onPendingEditsRef.current(
          pendingEdits.slice(appliedEditCountRef.current),
        );
        appliedEditCountRef.current = pendingEdits.length;
      }
    }
    if (update.progressMessages) {
      setProgressMessages(update.progressMessages);
    }
  }

  function resolveFinalTrace(
    startTime: number,
    traceId: string,
    latestLiveTraceRef: { current: ExecutionTrace | null },
    serverTrace?: AssistantExecutionTrace | ExecutionTrace,
    fallbackSteps: string[] = [],
  ): ExecutionTrace {
    const durationMs = Date.now() - startTime;
    if (serverTrace) {
      return {
        id: serverTrace.id || traceId,
        timestamp: serverTrace.timestamp || new Date().toISOString(),
        steps: serverTrace.steps ?? [],
        toolExecutions: serverTrace.toolExecutions ?? [],
        durationMs: serverTrace.durationMs || durationMs,
      };
    }
    if (latestLiveTraceRef.current) {
      return { ...latestLiveTraceRef.current, durationMs };
    }
    return {
      id: traceId,
      timestamp: new Date().toISOString(),
      steps: fallbackSteps,
      toolExecutions: [],
      durationMs,
    };
  }

  async function runAssistantLoop(
    userMessage: string,
    history: Array<{ role: string; content: string }>,
    userImages: string[] = [],
    options?: {
      bootMessage?: boolean;
      attachedImageUrls?: string[];
      signal?: AbortSignal;
      files?: Array<{ name: string; mimeType: string }>;
      displayContent?: string;
    },
  ): Promise<{
    type: string;
    answer?: string;
    question?: string;
    steps?: string[];
    suggestions?: string[];
    executionTrace?: ExecutionTrace;
    gatewaySessionId?: string;
    messages?: SpecialistMessage[];
  }> {
    if (!sendTurnRef.current && !workspaceId) {
      throw new Error("Missing workspace id");
    }

    if (options?.signal?.aborted) {
      throw new DOMException("Aborted by user", "AbortError");
    }

    setExecutionTraces([]);
    setProgressMessages([]);
    setPendingUiInput(null);
    const appliedEditCountRef = { current: 0 };

    const startTime = Date.now();
    const traceId = crypto.randomUUID();
    const latestLiveTraceRef = { current: null as ExecutionTrace | null };

    try {
      if (sendTurnRef.current) {
        const result = await sendTurnRef.current({
          specialistId,
          workspaceId,
          content: userMessage,
          history,
          imageUrls: userImages.length ? userImages : undefined,
          files: options?.files,
          onProgress: (update) =>
            handleProgressUpdate(update, appliedEditCountRef, latestLiveTraceRef),
        });

        if (options?.signal?.aborted) {
          throw new DOMException("Aborted by user", "AbortError");
        }

        const finalTrace = resolveFinalTrace(
          startTime,
          traceId,
          latestLiveTraceRef,
          result.executionTrace,
          result.steps,
        );

        return {
          type: result.type || "final",
          answer: result.answer,
          question: result.question,
          steps: finalTrace.steps,
          suggestions: result.suggestions,
          executionTrace: finalTrace,
          messages: result.messages,
        };
      }

      const result = await runAssistantMessage(
        specialistId as Parameters<typeof runAssistantMessage>[0],
        workspaceId!,
        {
          message: userMessage,
          messageImages: userImages.length ? userImages : undefined,
          attachedImageUrls: options?.attachedImageUrls?.length
            ? options.attachedImageUrls
            : undefined,
          history,
          gatewaySessionId: getSessionIdRef.current(),
          ...extraPayloadRef.current?.(),
          ...(options?.bootMessage ? { _bootMessage: true } : {}),
        },
        {
          onProgress: (update) =>
            handleProgressUpdate(update, appliedEditCountRef, latestLiveTraceRef),
        },
      );

      if (options?.signal?.aborted) {
        throw new DOMException("Aborted by user", "AbortError");
      }

      if (result.gatewaySessionId) {
        saveSessionIdRef.current(result.gatewaySessionId);
      }

      const finalTrace = resolveFinalTrace(
        startTime,
        traceId,
        latestLiveTraceRef,
        result.executionTrace,
        Array.isArray(result.steps) ? result.steps : [],
      );

      const finalPendingEdits = extractPendingEditsFromTraces([finalTrace]);
      if (
        finalPendingEdits.length > appliedEditCountRef.current &&
        onPendingEditsRef.current
      ) {
        onPendingEditsRef.current(
          finalPendingEdits.slice(appliedEditCountRef.current),
        );
      }

      return {
        type: result.type || "final",
        answer: result.answer,
        steps: finalTrace.steps,
        suggestions: Array.isArray(result.suggestions)
          ? result.suggestions
          : undefined,
        executionTrace: finalTrace,
        gatewaySessionId: result.gatewaySessionId,
      };
    } finally {
      setPendingUiInput(null);
    }
  }

  return {
    runAssistantLoop,
    clearActiveJobId: () => undefined,
    executionTraces,
    progressMessages,
    pendingUiInput,
    respondUiInput,
  };
}
