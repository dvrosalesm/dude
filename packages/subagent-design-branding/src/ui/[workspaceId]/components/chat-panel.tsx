"use client";

import { useEffect, useRef } from "react";
import { SubagentChat } from "@dude/chat/subagents/subagent-chat";
import { useSubagentChat } from "@dude/chat/subagents/hooks/use-subagent-chat";
import type { SubagentMessage } from "@dude/chat/subagents/types";
import { useDesignBrandingStore } from "@dude/subagent-design-branding/store";
import {
  CANVAS_ADD_REFERENCE_EVENT,
  type CanvasAddReferenceDetail,
} from "./nodes/canvas-ref-handle";

export function ChatPanel({
  setError,
  onWorkspaceChanged,
  messages,
  setMessages,
  messagesLoaded,
  collapsed,
  pendingPrompt,
  onPromptConsumed,
  onSendingChange,
}: {
  setError: (error: string | null) => void;
  onWorkspaceChanged?: () => void;
  messages: SubagentMessage[];
  setMessages: React.Dispatch<React.SetStateAction<SubagentMessage[]>>;
  messagesLoaded: boolean;
  collapsed: boolean;
  pendingPrompt?: string | null;
  onPromptConsumed?: () => void;
  onSendingChange?: (sending: boolean) => void;
}) {
  const { workspaceId, canvasSnapshot } = useDesignBrandingStore();
  const hasContext = (canvasSnapshot?.nodes?.length ?? 0) > 0;

  const chat = useSubagentChat({
    subagentId: "design-branding",
    workspaceId: workspaceId || undefined,
    messages,
    setMessages,
    messagesLoaded,
    bootMessage: () =>
      !hasContext
        ? "The user just opened a fresh design canvas. Greet them in one short sentence and ask what they want to design — a brand, a logo, a landing-page mockup, a campaign graphic, a presentation. Do not list every capability."
        : "Greet the user in one short sentence. Their canvas already has work on it. Suggest one concrete next step grounded in what's already there (e.g. add a complementary palette, generate three logo variants, mock a hero section).",
    wakingUpLabel: "Waking up the design assistant...",
    placeholder: "Ask the design assistant...",
    onAssistantResponse: onWorkspaceChanged,
  });

  useEffect(() => {
    setError(chat.sendError || null);
  }, [chat.sendError, setError]);

  useEffect(() => {
    onSendingChange?.(chat.sending);
  }, [chat.sending, onSendingChange]);

  const sendRef = useRef(chat.handleSendMessage);
  sendRef.current = chat.handleSendMessage;
  const consumeRef = useRef(onPromptConsumed);
  consumeRef.current = onPromptConsumed;
  const ready = !chat.sending && !chat.wakingUp && messagesLoaded;
  useEffect(() => {
    if (!pendingPrompt || !ready) return;
    void sendRef.current(pendingPrompt);
    consumeRef.current?.();
  }, [pendingPrompt, ready]);

  const addRefRef = useRef(chat.chatProps.onAddFileReference);
  addRefRef.current = chat.chatProps.onAddFileReference;
  useEffect(() => {
    function onAddRef(e: Event) {
      const detail = (e as CustomEvent<CanvasAddReferenceDetail>).detail;
      if (!detail || !addRefRef.current) return;
      addRefRef.current({
        id: detail.id,
        name: detail.name,
        content: detail.content,
      });
    }
    window.addEventListener(CANVAS_ADD_REFERENCE_EVENT, onAddRef);
    return () => window.removeEventListener(CANVAS_ADD_REFERENCE_EVENT, onAddRef);
  }, []);

  return (
    <SubagentChat
      {...chat.chatProps}
      inputLayout="docked"
      historyLayout="workspace"
      messagesCollapsed={collapsed}
    />
  );
}
