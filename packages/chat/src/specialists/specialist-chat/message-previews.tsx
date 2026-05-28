"use client";

import { Sparkles } from "lucide-react";
import {
  chatAssistantBubbleClassName,
  chatAttachmentPillClassName,
  chatUserBubbleClassName,
  cn,
} from "@dude/ui/design-system";
import { ChatMarkdown } from "../../components/chat/chat-markdown";
import type { ExecutionTrace, SpecialistMessage } from "../types";
import {
  AttachedFilePill,
  attachmentIndexLabel,
  attachmentLabel,
  formatMessageContent,
  isImageAttachment,
} from "./helpers";
import { liveStepLabel } from "./trace-labels";

export function ChatImageThumb({
  src,
  alt,
  variant = "thumb",
  onClick,
  onEdit,
}: {
  src: string;
  alt: string;
  variant?: "thumb" | "standalone";
  onClick?: (src: string) => void;
  onEdit?: (src: string) => void;
}) {
  const isStandalone = variant === "standalone";
  return (
    <div className="relative group/chat-img">
      <button
        type="button"
        onClick={() => onClick?.(src)}
        className={
          isStandalone
            ? "block max-w-[120px] overflow-hidden rounded-2xl hover:opacity-80 transition-opacity"
            : "block overflow-hidden rounded-lg hover:opacity-80 transition-opacity"
        }
      >
        <img
          src={src}
          alt={alt}
          className={isStandalone ? "w-full object-cover" : "h-20 w-20 object-cover"}
        />
      </button>
      {onEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(src);
          }}
          className="absolute top-1 right-1 inline-flex items-center gap-1 rounded-full bg-background/95 backdrop-blur px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm opacity-0 group-hover/chat-img:opacity-100 transition-opacity hover:bg-background"
          title="Edit this image"
        >
          <Sparkles className="h-3 w-3" />
          Edit
        </button>
      )}
    </div>
  );
}

export function LastMessagePreview({
  messages,
  sending,
  executionTraces,
  onImageClick,
  recovering,
}: {
  messages: SpecialistMessage[];
  sending: boolean;
  executionTraces?: ExecutionTrace[];
  onImageClick?: (src: string) => void;
  recovering?: boolean;
}) {
  const visible = messages.filter((m) => !m.hidden && m.role !== "image");
  const last = visible[visible.length - 1];
  const showTyping = sending && (!last || last.role === "user");
  const liveLabel = showTyping ? liveStepLabel(executionTraces) : "";
  const stepLabel =
    showTyping && !liveLabel && recovering
      ? "Working…"
      : liveLabel;

  if (!last && !showTyping) return null;

  const lastIsUser = last?.role === "user";
  const lastImages = Array.isArray(last?.images) ? last!.images! : [];

  return (
    <>
      {last && (
        <div className={`pointer-events-auto flex flex-col gap-1.5 ${lastIsUser ? "items-end" : "items-start"}`}>
          <div
            className={cn(
              "overflow-y-auto shadow-none",
              lastIsUser ? chatUserBubbleClassName() : chatAssistantBubbleClassName(),
            )}
            style={{ maxHeight: "35vh" }}
          >
            <ChatMarkdown content={formatMessageContent(last.answer ?? last.message)} />
            {!lastIsUser && lastImages.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {lastImages.map((image, imageIndex) => (
                  <button
                    key={`preview-img-${imageIndex}`}
                    type="button"
                    onClick={() => onImageClick?.(image)}
                    className="block overflow-hidden rounded-lg hover:opacity-80 transition-opacity"
                  >
                    <img src={image} alt={`Attachment ${imageIndex + 1}`} className="h-20 w-20 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          {lastIsUser && lastImages.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {lastImages.map((image, imageIndex) => {
                const asImage = isImageAttachment(image);
                const label =
                  lastImages.length === 1
                    ? attachmentLabel(image)
                    : attachmentIndexLabel(image, imageIndex, lastImages.length);
                if (!asImage) {
                  return (
                    <AttachedFilePill
                      key={`preview-img-ref-${imageIndex}`}
                      url={image}
                      label={label}
                    />
                  );
                }
                return (
                  <button
                    key={`preview-img-ref-${imageIndex}`}
                    type="button"
                    onClick={() => onImageClick?.(image)}
                    className={chatAttachmentPillClassName()}
                    title="View attached image"
                  >
                    <img
                      src={image}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover shrink-0"
                    />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {showTyping && (
        <div className="pointer-events-auto flex justify-start" role="status" aria-label="Working">
          <div className="rounded-2xl rounded-bl-md bg-[var(--dude-surface-2)] px-4 py-2.5 flex items-center gap-2">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-[typing-bounce_1.4s_ease-in-out_infinite]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-[typing-bounce_1.4s_ease-in-out_0.2s_infinite]" />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-[typing-bounce_1.4s_ease-in-out_0.4s_infinite]" />
            </div>
            {stepLabel && (
              <span className="text-xs text-muted-foreground max-w-[260px] truncate">
                {stepLabel}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Messages list (shared between layouts)
// ---------------------------------------------------------------------------
