"use client";

import {
  chatInputShellClassName,
  cn,
} from "@dude/ui/design-system";
import AutoResizingTextarea from "../../components/common/copilot-textarea";
import { ArrowUp, FileText, Paperclip, Square, Trash2, X } from "lucide-react";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import { useCallback, useRef, useState } from "react";
import type { ChatImageAttachment, FileReference } from "../types";

export function InputBar({
  newMessage,
  onMessageChange,
  onSend,
  onStop,
  canSend,
  sending,
  sendError,
  attachments,
  onRemoveImage,
  placeholder,
  fileInputRef,
  handleFiles,
  onAttachImages,
  fileReferences,
  onAddFileReference,
  onRemoveFileReference,
  onClearChat,
  hasMessages,
  extraInputControls,
  flushTop,
  variant = "bar",
  placeholderStyle = "default",
}: {
  newMessage: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  canSend: boolean;
  sending: boolean;
  sendError?: string | null;
  attachments: ChatImageAttachment[];
  onRemoveImage: (id: string) => void;
  placeholder: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFiles: (files: FileList | null) => void;
  onAttachImages: (files: File[], source?: "picker" | "clipboard") => Promise<void> | void;
  fileReferences?: FileReference[];
  onAddFileReference?: (ref: FileReference) => void;
  onRemoveFileReference?: (id: string) => void;
  onClearChat?: () => void;
  hasMessages?: boolean;
  extraInputControls?: React.ReactNode;
  /** When true, top corners and top border drop so the bar reads as the bottom of an expanded panel. */
  flushTop?: boolean;
  variant?: "bar" | "open";
  placeholderStyle?: "default" | "scribble";
}) {
  const [dragOver, setDragOver] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const isOpen = variant === "open";
  const useScribblePlaceholder = isOpen && placeholderStyle === "scribble";
  const showScribblePlaceholder =
    useScribblePlaceholder && !newMessage.trim() && !inputFocused;

  const handleDragOver = (event: React.DragEvent) => {
    const hasFiles = Array.from(event.dataTransfer.types).includes("Files");
    const hasNode = event.dataTransfer.types.includes("application/x-subagent-node");
    if (!hasFiles && !hasNode) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = hasNode ? "move" : "copy";
    setDragOver(true);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);

    const nodeData = event.dataTransfer.getData("application/x-subagent-node");
    const textData = event.dataTransfer.getData("text/plain");
    if (nodeData && textData && onAddFileReference) {
      try {
        const node = JSON.parse(nodeData);
        if (!fileReferences?.some((ref) => ref.id === node.id)) {
          onAddFileReference({
            id: node.id,
            name: node.name,
            content: textData,
          });
        }
      } catch {
        /* ignore */
      }
    }

    if (event.dataTransfer.files?.length) {
      handleFiles(event.dataTransfer.files);
    }
  };

  const attachmentPreviews = (
    <>
      {fileReferences && fileReferences.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap gap-1.5",
            isOpen ? "mb-2 justify-center" : "px-4 pt-3",
          )}
        >
          {fileReferences.map((ref) => (
            <span
              key={ref.id}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--dude-surface)] px-2.5 py-1 text-xs text-[var(--dude-muted)]"
            >
              {ref.name}
              {onRemoveFileReference && (
                <button
                  type="button"
                  onClick={() => onRemoveFileReference(ref.id)}
                  className="rounded-full p-0.5 transition-colors hover:bg-[var(--dude-surface)]"
                  aria-label={`Remove ${ref.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            isOpen ? "mb-2 justify-center" : "px-4 pt-3",
          )}
        >
          {attachments.map((attachment, index) => {
            const isImage =
              attachment.mimeType?.startsWith("image/") &&
              attachment.dataUrl !== "placeholder";
            const ext =
              attachment.name?.split(".").pop()?.toUpperCase() ||
              attachment.mimeType?.split("/")[1]?.toUpperCase() ||
              "FILE";
            return (
              <div
                key={attachment.id}
                className={
                  isImage
                    ? "relative group h-16 w-16 overflow-hidden rounded-lg"
                    : "relative group flex h-16 max-w-[220px] items-center gap-2.5 rounded-lg bg-[var(--dude-surface)] px-3"
                }
              >
                {isImage ? (
                  <img
                    src={attachment.dataUrl}
                    alt={attachment.name || `Selected image ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--dude-surface-2)]">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">
                        {attachment.name || "Document"}
                      </p>
                      <p className="text-[10px] font-mono tracking-wider text-muted-foreground">
                        {ext}
                      </p>
                    </div>
                  </>
                )}
                {attachment.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
                    <BrailleSpinner className="text-xs text-[var(--dude-bg)]" />
                  </div>
                )}
                {!attachment.uploading && (
                  <button
                    type="button"
                    onClick={() => onRemoveImage(attachment.id)}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-[var(--dude-bg)] opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  const textareaEl = (
    <AutoResizingTextarea
      data-subagent-input="true"
      placeholder={useScribblePlaceholder ? "" : placeholder}
      aria-label={useScribblePlaceholder ? placeholder : undefined}
      value={newMessage}
      maxRows={isOpen ? 8 : 3}
      onChange={(event) => onMessageChange(event.target.value)}
      onPaste={(event) => {
        const items = event.clipboardData?.items;
        if (!items) return;
        const files: File[] = [];
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === "file") {
            const file = items[i].getAsFile();
            if (file) files.push(file);
          }
        }
        if (files.length) {
          event.preventDefault();
          void onAttachImages(files, "clipboard");
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          if (canSend) onSend();
        }
      }}
      onFocus={() => setInputFocused(true)}
      onBlur={() => setInputFocused(false)}
      className={cn(
        "flex-1 resize-none border-0 bg-transparent focus:outline-none focus:ring-0 placeholder:text-muted-foreground/60",
        isOpen
          ? "dude-open-input-text min-h-[5rem] w-full px-0 py-1 text-center text-[var(--dude-text)] placeholder:text-center"
          : "text-sm",
      )}
      style={isOpen ? undefined : { minHeight: "24px" }}
    />
  );

  if (isOpen) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-1 text-center">
        <div
          className={cn(
            "relative w-full transition-colors",
            dragOver && "rounded-xl bg-[var(--dude-accent-soft)]/35",
          )}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.txt,.csv,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            multiple
            className="hidden"
            onChange={(event) => {
              handleFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
          {extraInputControls}
          {attachmentPreviews}
          <div className="relative w-full">
            {showScribblePlaceholder && (
              <span
                aria-hidden
                className="dude-open-input-text dude-input-scribble absolute inset-x-0 top-3 z-0 flex justify-center"
              >
                <span className="dude-input-scribble__line">write here</span>
              </span>
            )}
            <div className="relative z-[1]">{textareaEl}</div>
          </div>
        </div>
        {sendError && <p className="text-sm text-destructive">{sendError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
    <div
      className={chatInputShellClassName(dragOver)}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,.txt,.csv,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        multiple
        className="hidden"
        onChange={(event) => { handleFiles(event.target.files); event.currentTarget.value = ""; }}
      />

      {attachmentPreviews}

      <div className="flex items-end gap-2 px-4 py-3">
        {textareaEl}
      </div>

      <div className="flex items-center justify-between px-3 pb-2.5">
        <div className="flex items-center gap-0.5">
          {extraInputControls}
          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center rounded-full p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors" aria-label="Attach files" title="Attach images, PDFs, or documents">
            <Paperclip className="h-5 w-5" />
          </button>
          {onClearChat && hasMessages && !sending && (
            confirmClear ? (
              <span className="flex items-center gap-1.5 ml-1">
                <button
                  type="button"
                  onClick={() => { onClearChat(); setConfirmClear(false); }}
                  className="rounded-full px-3 py-1 text-sm font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded-full px-3 py-1 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="group/clear flex items-center gap-1 rounded-full p-1.5 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Clear chat"
              >
                <Trash2 className="h-5 w-5" />
                <span className="text-sm whitespace-nowrap max-w-0 overflow-hidden opacity-0 group-hover/clear:max-w-24 group-hover/clear:opacity-100 group-hover/clear:pr-1.5 transition-all duration-200">Clear chat</span>
              </button>
            )
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {sending && onStop ? (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center justify-center rounded-full h-7 w-7 bg-[var(--dude-surface)] text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="Stop generating"
              title="Stop generating"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend || sending}
              className="flex items-center justify-center rounded-full h-7 w-7 bg-foreground text-background transition-colors disabled:opacity-30 hover:opacity-80"
              aria-label="Send"
              title="Send"
            >
              {sending ? (
                <BrailleSpinner className="text-base leading-none" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {sendError && <p className="mx-4 mb-2 text-sm text-destructive">{sendError}</p>}
    </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

