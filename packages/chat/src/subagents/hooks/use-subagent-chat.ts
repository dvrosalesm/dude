"use client";

/**
 * Shared subagent chat hook.
 *
 * Wires together: workspace messages, gateway session, assistant loop,
 * image attachments, auto-boot greeting. Returns everything needed
 * to render <SubagentChat>.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  abandonAssistantTurn,
  clearAssistant,
  reloadAssistantMessages,
  resumeAssistantIfActive,
} from "@dude/workspaces";
import type { SubagentId } from "@dude/client-types";
import { useGatewaySession } from "./use-gateway-session";
import { useAssistantLoop } from "./use-assistant-loop";
import type { SubagentMessage, ChatImageAttachment, FileReference } from "../types";
import { attachAndUploadImages } from "./upload-chat-images";
import type { UseSubagentChatConfig } from "./subagent-chat-types";
import { buildAttachedFilePromptBlock, buildChatHistory } from "./build-chat-history";
import {
  appendAssistantMessage,
  applyAssistantTurnResult,
  bootedWorkspaceKeys,
  uiMessageToSubagentMessage,
  workspaceBootKey,
} from "./subagent-chat-message-utils";

export type {
  UseSubagentChatConfig,
  SubagentChatSendTurnInput,
  SubagentChatSendTurnResult,
} from "./subagent-chat-types";

export function useSubagentChat(config: UseSubagentChatConfig) {
  const {
    subagentId,
    workspaceId,
    messages,
    setMessages,
    bootMessage,
    wakingUpLabel,
    placeholder = "Type a message...",
    extraPayload,
    onAssistantResponse,
    messagesLoaded,
    disableHistory,
    initialAttachments,
    sendTurn,
    enableStop = true,
    onPinMessage,
    clearThread,
    respondUiInputTurn,
    onPendingEdits,
  } = config;

  const [newMessage, setNewMessage] = useState("");
  const [attachments, setAttachments] = useState<ChatImageAttachment[]>(
    () => initialAttachments ?? [],
  );
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [wakingUp, setWakingUp] = useState(false);
  const [fileReferences, setFileReferences] = useState<FileReference[]>([]);
  const [recovering, setRecovering] = useState(false);

  const usesDirectSend = Boolean(sendTurn);
  const session = useGatewaySession(subagentId, workspaceId);
  const abortRef = useRef<AbortController | null>(null);

  const loop = useAssistantLoop({
    subagentId,
    workspaceId,
    getSessionId: session.getSessionId,
    saveSessionId: session.saveSessionId,
    extraPayload,
    onPendingEdits,
    sendTurn,
    respondUiInputTurn,
  });
  const {
    runAssistantLoop,
    clearActiveJobId,
    executionTraces,
    progressMessages,
    pendingUiInput,
    respondUiInput,
  } = loop;

  const anyUploading = attachments.some((a) => a.uploading);
  const canSend = useMemo(
    () => (Boolean(newMessage.trim()) || attachments.length > 0) && !sending && !anyUploading,
    [newMessage, attachments.length, sending, anyUploading],
  );

  const bootedRef = useRef(false);
  useEffect(() => {
    bootedRef.current = false;
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !messagesLoaded || usesDirectSend) return;

    let cancelled = false;

    const clearWaitState = () => {
      setRecovering(false);
      setSending(false);
    };

    void (async () => {
      const reloaded = await reloadAssistantMessages(
        subagentId as SubagentId,
        workspaceId,
      );
      if (cancelled) return;
      if (reloaded.length > 0) {
        setMessages(reloaded.map(uiMessageToSubagentMessage));
      }

      const resumed = await resumeAssistantIfActive(
        subagentId as SubagentId,
        workspaceId,
      );
      if (cancelled || !resumed.active || !resumed.promise) return;

      setSending(true);
      setRecovering(Boolean(resumed.reattaching));

      const waitMs = 120_000;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          resumed.promise,
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error("Timed out waiting for the agent")),
              waitMs,
            );
          }),
        ]);
        if (cancelled) return;
        const fresh = await reloadAssistantMessages(
          subagentId as SubagentId,
          workspaceId,
        );
        if (!cancelled) {
          setMessages(fresh.map(uiMessageToSubagentMessage));
          onAssistantResponse?.();
        }
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          setSendError(err instanceof Error ? err.message : "Something went wrong");
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (!cancelled) {
          clearWaitState();
        }
      }
    })();

    return () => {
      cancelled = true;
      clearWaitState();
    };
  }, [
    workspaceId,
    messagesLoaded,
    usesDirectSend,
    subagentId,
    setMessages,
    onAssistantResponse,
  ]);

  useEffect(() => {
    if (!workspaceId || !bootMessage || !messagesLoaded) return;

    const bootKey = workspaceBootKey(subagentId, workspaceId);
    if (bootedWorkspaceKeys.has(bootKey)) {
      bootedRef.current = true;
      return;
    }

    if (bootedRef.current || messages.length > 0) {
      bootedRef.current = true;
      return;
    }

    bootedRef.current = true;
    bootedWorkspaceKeys.add(bootKey);

    const msg = typeof bootMessage === "function" ? bootMessage() : bootMessage;
    setWakingUp(true);
    void sendHiddenMessage(msg);
  }, [workspaceId, subagentId, messagesLoaded, messages.length, bootMessage]);

  async function sendHiddenMessage(text: string) {
    setSending(true);
    setSendError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const history = buildChatHistory(messages, disableHistory);
      const data = await runAssistantLoop(text, history, [], {
        bootMessage: true,
        signal: controller.signal,
      });
      appendAssistantMessage(setMessages, data);
      onAssistantResponse?.();
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setSendError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false);
      setWakingUp(false);
    }
  }

  async function runVisibleTurn(params: {
    displayContent: string;
    userMessage: string;
    attachedImages: string[];
    attachedFileUrls: string[];
    attachedFiles?: Array<{ name: string; mimeType: string }>;
    optimisticUser: SubagentMessage;
  }) {
    const controller = new AbortController();
    abortRef.current = controller;
    const pendingId = usesDirectSend ? params.optimisticUser.id : undefined;

    setMessages((prev) => [...prev, params.optimisticUser]);

    try {
      const history = buildChatHistory(messages, disableHistory);
      const data = await runAssistantLoop(
        params.userMessage,
        history,
        params.attachedImages,
        {
          attachedImageUrls: params.attachedFileUrls,
          signal: controller.signal,
          files: params.attachedFiles,
          displayContent: params.displayContent,
        },
      );
      applyAssistantTurnResult({
        pendingId,
        result: data,
        setMessages,
        onAssistantResponse,
      });
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      if (pendingId && !aborted) {
        setMessages((prev) => prev.filter((message) => message.id !== pendingId));
      }
      if (!aborted) {
        setSendError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false);
    }
  }

  async function handleSendMessage(messageOverride?: string) {
    const text = messageOverride ?? newMessage;
    const hasContent =
      Boolean(text.trim()) ||
      attachments.length > 0 ||
      (!usesDirectSend && fileReferences.length > 0);
    if ((!usesDirectSend && !workspaceId) || !hasContent || sending) {
      return;
    }

    const refs = fileReferences.length
      ? fileReferences.map((r) => r.content).join("\n\n") + "\n\n"
      : "";
    const attachedFileUrls = attachments
      .map((a) => a.dataUrl)
      .filter((url) => url && url !== "placeholder");
    const imageAttachments = attachments.filter(
      (a) => a.mimeType?.startsWith("image/") && a.dataUrl !== "placeholder",
    );
    const fileAttachments = attachments.filter((a) => !a.mimeType?.startsWith("image/"));
    const attachedImages = imageAttachments.map((a) => a.dataUrl);
    const attachmentBlock = buildAttachedFilePromptBlock(attachedFileUrls);
    const userMessage = [refs + text.trim(), attachmentBlock].filter(Boolean).join("\n\n").trim();

    setNewMessage("");
    setAttachments([]);
    setFileReferences([]);
    setSending(true);
    setSendError(null);
    abortRef.current?.abort();

    const attachedRefs = fileReferences.map((r) => ({ label: r.name }));
    const attachedFiles = fileAttachments.map((a) => ({
      name: a.name,
      mimeType: a.mimeType,
    }));
    const pendingId = usesDirectSend ? `pending-user-${Date.now()}` : undefined;

    await runVisibleTurn({
      displayContent: text.trim(),
      userMessage,
      attachedImages,
      attachedFileUrls,
      attachedFiles: attachedFiles.length ? attachedFiles : undefined,
      optimisticUser: {
        ...(pendingId ? { id: pendingId } : {}),
        role: "user",
        message: text.trim(),
        images: attachedImages.length ? attachedImages : undefined,
        attachedRefs: attachedRefs.length ? attachedRefs : undefined,
        files: attachedFiles.length ? attachedFiles : undefined,
      },
    });
  }

  async function sendMessageWithImages(text: string, imageUrls: string[]) {
    if ((!usesDirectSend && !workspaceId) || sending) return;
    const trimmed = text.trim();
    if (!trimmed && imageUrls.length === 0) return;

    const attachmentBlock = buildAttachedFilePromptBlock(imageUrls);
    const userMessage = [trimmed, attachmentBlock].filter(Boolean).join("\n\n").trim();

    setSending(true);
    setSendError(null);
    abortRef.current?.abort();

    const pendingId = usesDirectSend ? `pending-user-${Date.now()}` : undefined;
    await runVisibleTurn({
      displayContent: trimmed,
      userMessage,
      attachedImages: imageUrls,
      attachedFileUrls: imageUrls,
      optimisticUser: {
        ...(pendingId ? { id: pendingId } : {}),
        role: "user",
        message: trimmed,
        images: imageUrls.length ? imageUrls : undefined,
      },
    });
  }

  async function handleRespondUiInput(response: {
    action: "submit" | "cancel";
    confirmed?: boolean;
    value?: string;
    selectedOptionId?: string;
  }) {
    await respondUiInput(response);
  }

  function handleStopSending() {
    abortRef.current?.abort();
    abortRef.current = null;
    clearActiveJobId();
    if (workspaceId) {
      abandonAssistantTurn(subagentId as SubagentId, workspaceId);
    }
    setSending(false);
    setWakingUp(false);
  }

  async function handleAttachImages(
    files: File[],
    source: "picker" | "clipboard" = "picker",
  ) {
    setSendError(null);
    await attachAndUploadImages(
      files,
      attachments.length,
      setAttachments,
      setSendError,
      { acceptPdf: true, source },
    );
  }

  function handleRemoveImage(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function handleAddFileReference(ref: FileReference) {
    setFileReferences((prev) => {
      if (prev.some((r) => r.id === ref.id)) return prev;
      return [...prev, ref];
    });
  }

  function handleRemoveFileReference(id: string) {
    setFileReferences((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleClearChat() {
    if (sending) return;
    if (clearThread) {
      const nextMessages = await clearThread();
      setMessages(nextMessages);
      session.clearSessionId();
      clearActiveJobId();
      bootedRef.current = false;
      if (workspaceId) {
        bootedWorkspaceKeys.delete(workspaceBootKey(subagentId, workspaceId));
      }
      return;
    }
    setMessages([]);
    session.clearSessionId();
    clearActiveJobId();
    bootedRef.current = false;
    if (workspaceId) {
      bootedWorkspaceKeys.delete(workspaceBootKey(subagentId, workspaceId));
    }
    if (workspaceId) {
      void clearAssistant(subagentId, workspaceId);
    }
  }

  const chatProps = {
    messages,
    newMessage,
    onMessageChange: setNewMessage,
    onSend: handleSendMessage,
    onStop: enableStop ? handleStopSending : undefined,
    canSend,
    sending,
    sendError,
    attachments,
    onAttachImages: handleAttachImages,
    onRemoveImage: handleRemoveImage,
    executionTraces,
    progressMessages,
    wakingUp,
    wakingUpLabel,
    placeholder,
    pendingUiInput,
    onRespondUiInput: handleRespondUiInput,
    fileReferences,
    onAddFileReference: handleAddFileReference,
    onRemoveFileReference: handleRemoveFileReference,
    onClearChat: handleClearChat,
    onPinMessage,
    recovering,
  };

  return {
    messages,
    setMessages,
    newMessage,
    setNewMessage,
    attachments,
    sending,
    sendError,
    canSend,
    wakingUp,
    executionTraces,
    handleSendMessage,
    handleStopSending,
    sendMessageWithImages,
    handleAttachImages,
    handleRemoveImage,
    handleClearChat,
    chatProps,
  };
}
