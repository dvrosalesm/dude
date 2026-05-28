"use client";

/**
 * Shared subagent chat UI — thin composer over focused submodules.
 */

import { X } from "lucide-react";
import { cn } from "@dude/ui/design-system";
import { useEffect, useRef, useState } from "react";
import { MainAssistantStage } from "./main-assistant-stage";
import { InputBar } from "./subagent-chat/input-bar";
import { MessagesList } from "./subagent-chat/messages-list";
import { LastMessagePreview } from "./subagent-chat/message-previews";
import type { SubagentChatProps } from "./subagent-chat-props";

export type { SubagentChatProps } from "./subagent-chat-props";

export function SubagentChat(props: SubagentChatProps) {
  const {
    messages,
    newMessage,
    onMessageChange,
    onSend,
    onStop,
    canSend,
    sending,
    sendError,
    attachments,
    onAttachImages,
    onRemoveImage,
    executionTraces,
    progressMessages,
    wakingUp,
    wakingUpLabel,
    placeholder = "Type a message...",
    toolIcons,
    argPreview,
    inputLayout = "docked",
    fileReferences,
    onAddFileReference,
    onRemoveFileReference,
    onClearChat,
    onSaveReport,
    messagesCollapsed,
    extraInputControls,
    onPinMessage,
    hasMoreMessages,
    onLoadMore,
    loadingMore,
    inputMaxWidthClass = "max-w-2xl",
    inputVariant = "bar",
    inputPlaceholderStyle = "default",
    messagesPrependContent,
    wrapperLayout = "fill",
    recovering,
    onEditImage,
    onInterceptFiles,
    onSuggestionAction,
    historyLayout = "bubbles",
    workspaceHome,
    pendingUiInput,
    onRespondUiInput,
    projectHub,
  } = props;

  const isStage = historyLayout === "stage";
  const isWorkspace = historyLayout === "workspace";
  const visibleCount = messages.filter((m) => !m.hidden).length;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [showWakingUp, setShowWakingUp] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const usesCollapsibleDock = messagesCollapsed !== undefined;
  const flushInputTop = messagesCollapsed === false;

  useEffect(() => {
    if (wakingUp) setShowWakingUp(true);
  }, [wakingUp]);
  useEffect(() => {
    if (!showWakingUp) return;
    if (messages.filter((m) => !m.hidden).some((m) => m.role === "assistant")) {
      setShowWakingUp(false);
    }
  }, [showWakingUp, messages]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
  }, [
    messages.length,
    executionTraces,
    showWakingUp,
    sending,
    messagesCollapsed,
  ]);

  function attachFiles(files: File[], source: "picker" | "clipboard" = "picker") {
    if (!files.length) return;
    if (onInterceptFiles?.(files)) return;
    void onAttachImages(files, source);
  }

  function handleFiles(fileList: FileList | File[] | null) {
    if (!fileList?.length) return;
    attachFiles(Array.from(fileList), "picker");
  }

  const inputBarEl = (
    <InputBar
      newMessage={newMessage}
      onMessageChange={onMessageChange}
      onSend={() => onSend()}
      onStop={onStop}
      canSend={canSend}
      sending={sending}
      sendError={sendError}
      attachments={attachments}
      onRemoveImage={onRemoveImage}
      placeholder={placeholder}
      fileInputRef={fileInputRef}
      handleFiles={handleFiles}
      onAttachImages={(files, source) => attachFiles(files, source ?? "picker")}
      fileReferences={fileReferences}
      onAddFileReference={onAddFileReference}
      onRemoveFileReference={onRemoveFileReference}
      onClearChat={onClearChat}
      hasMessages={messages.filter((m) => !m.hidden).length > 0}
      extraInputControls={extraInputControls}
      flushTop={flushInputTop}
      variant={inputVariant}
      placeholderStyle={inputPlaceholderStyle}
    />
  );

  const messagesEl =
    historyLayout === "stage" ? (
      <MainAssistantStage
        messages={messages}
        sending={sending}
        executionTraces={executionTraces}
        progressMessages={progressMessages}
        workspaceHome={workspaceHome}
        onSend={onSend}
        onSuggestionAction={onSuggestionAction}
        onImageClick={setLightboxSrc}
        onSaveReport={onSaveReport}
        onPinMessage={onPinMessage}
        bottomRef={bottomRef}
        showWakingUp={showWakingUp}
        wakingUpLabel={wakingUpLabel}
        recovering={recovering}
        pendingUiInput={pendingUiInput}
        onRespondUiInput={onRespondUiInput}
        projectHub={projectHub}
      />
    ) : (
      <MessagesList
        messages={messages}
        sending={sending}
        wakingUp={wakingUp}
        showWakingUp={showWakingUp}
        wakingUpLabel={wakingUpLabel}
        executionTraces={executionTraces}
        progressMessages={progressMessages}
        toolIcons={toolIcons}
        argPreview={argPreview}
        onSend={onSend}
        onSaveReport={onSaveReport}
        onPinMessage={onPinMessage}
        onImageClick={setLightboxSrc}
        onEditImage={onEditImage}
        onSuggestionAction={onSuggestionAction}
        hasMoreMessages={hasMoreMessages}
        onLoadMore={onLoadMore}
        loadingMore={loadingMore}
        bottomRef={bottomRef}
        prependContent={messagesPrependContent}
        recovering={recovering}
        historyLayout={historyLayout}
        workspaceHome={workspaceHome}
        pendingUiInput={pendingUiInput}
        onRespondUiInput={onRespondUiInput}
      />
    );

  if (inputLayout === "floating") {
    return (
      <section className="relative min-h-[20vh] pb-32">
        <div className="flex flex-col space-y-4 pb-24">{messagesEl}</div>
        <div className="fixed bottom-6 left-1/2 z-20 w-full max-w-2xl -translate-x-1/2 px-4">
          {inputBarEl}
        </div>
      </section>
    );
  }

  const inputDockClass = `${usesCollapsibleDock ? "pointer-events-auto mt-auto " : ""}relative z-10 shrink-0 ${inputVariant === "open" ? "flex justify-center pb-8 pt-4" : "pb-5 pt-2"} mx-auto w-full ${inputMaxWidthClass} px-4`;

  const sectionHeightClass =
    wrapperLayout === "auto"
      ? ""
      : usesCollapsibleDock
        ? messagesCollapsed
          ? "h-full justify-end"
          : "h-full"
        : "h-full";

  const messagesAreaClass =
    wrapperLayout === "auto"
      ? "flex flex-col px-6 py-4"
      : isStage && visibleCount === 0 && !sending
        ? "flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4"
        : isStage
          ? "flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-0"
          : historyLayout === "workspace" && visibleCount === 0 && !sending
            ? "flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-4"
            : historyLayout === "workspace"
              ? "flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 pt-4"
              : "flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-4";

  return (
    <section className={`relative flex flex-col ${sectionHeightClass}`}>
      {usesCollapsibleDock ? (
        !messagesCollapsed ? (
          <div className="pointer-events-none flex shrink-0 flex-col justify-end px-2 pb-2">
            <LastMessagePreview
              messages={messages}
              sending={sending}
              executionTraces={executionTraces}
              onImageClick={setLightboxSrc}
              recovering={recovering}
            />
          </div>
        ) : null
      ) : (
        <div className={messagesAreaClass}>
          <div
            className={cn(
              "flex min-h-full flex-col pb-4",
              !isStage && (isWorkspace ? "space-y-8" : "space-y-6"),
              (isStage || isWorkspace) &&
                visibleCount === 0 &&
                !sending &&
                "min-h-full justify-center",
            )}
          >
            {messagesEl}
          </div>
        </div>
      )}
      <div className={inputDockClass} data-floating-chat-anchor>
        {inputBarEl}
      </div>
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-[var(--dude-bg)] hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxSrc}
            alt="Full size"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
