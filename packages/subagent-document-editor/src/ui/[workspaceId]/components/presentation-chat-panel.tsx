"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, RectangleHorizontal, Sparkles, X } from "lucide-react";
import { SubagentChat } from "@dude/chat/subagents/subagent-chat";
import { useSubagentChat } from "@dude/chat/subagents/hooks/use-subagent-chat";
import type { SubagentMessage } from "@dude/chat/subagents/types";
import { useDocumentEditorStore } from "@dude/presentation-editor/store";
import { getDocumentContext } from "@dude/presentation-editor/lib/document-context";
import { evaluatePresentationQuality } from "@dude/presentation-editor/lib/slide-quality";
import type { PptxContent } from "@dude/presentation-editor/types";
import { cn } from "@dude/ui/utils";
import { useWorkspaceId } from "@dude/subagent-params";
import { extractTextFromFile, uploadBodyFromFile } from "@dude/workspaces";

const PRESENTATION_SPECIALIST_ID = "presentation-editor" as const;

const DIMENSION_PRESETS = [
  { key: "16:9", label: "16:9", description: "Widescreen", width: 12192000, height: 6858000 },
  { key: "4:3", label: "4:3", description: "Standard", width: 9144000, height: 6858000 },
  { key: "16:10", label: "16:10", description: "Wide", width: 12192000, height: 7620000 },
  { key: "portrait", label: "9:16", description: "Vertical", width: 6858000, height: 12192000 },
  { key: "square", label: "1:1", description: "Square", width: 9144000, height: 9144000 },
  { key: "a4", label: "A4", description: "A4 Portrait", width: 6858000, height: 9144000 },
];

function PresentationInputControls({
  onResize,
  sending,
  onQualityReview,
}: {
  onResize: (width: number, height: number) => void;
  sending: boolean;
  onQualityReview: () => void;
}) {
  const currentDims = useDocumentEditorStore(
    (s) => (s.document?.content as PptxContent | undefined)?.slideDimensions,
  );
  const [showDimensions, setShowDimensions] = useState(false);
  const dimensionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDimensions) return;
    function handleClick(e: MouseEvent) {
      if (dimensionsRef.current && !dimensionsRef.current.contains(e.target as Node)) {
        setShowDimensions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDimensions]);

  return (
    <>
      <button
        type="button"
        disabled={sending}
        onClick={onQualityReview}
        className="flex items-center justify-center rounded-full p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
        title="Quality review"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <div ref={dimensionsRef}>
        <button
          type="button"
          disabled={sending}
          onClick={() => setShowDimensions((v) => !v)}
          className="flex items-center justify-center rounded-full p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
          title="Slide dimensions"
        >
          <RectangleHorizontal className="h-5 w-5" />
        </button>
        {showDimensions &&
          createPortal(
            <div
              ref={(el) => {
                if (!el || !dimensionsRef.current) return;
                const btn = dimensionsRef.current.getBoundingClientRect();
                el.style.position = "fixed";
                el.style.left = `${btn.left}px`;
                el.style.top = `${btn.top - el.offsetHeight - 8}px`;
              }}
              className="w-44 rounded-xl border border-border bg-background shadow-lg py-1 z-[9999]"
            >
              <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Slide size
              </div>
              {DIMENSION_PRESETS.map((preset) => {
                const isActive =
                  currentDims?.width === preset.width && currentDims?.height === preset.height;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => {
                      setShowDimensions(false);
                      onResize(preset.width, preset.height);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-1.5 text-sm transition-colors",
                      isActive ? "bg-primary/10 text-primary" : "hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "font-medium",
                        isActive ? "text-primary" : "text-foreground",
                      )}
                    >
                      {preset.label}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        isActive ? "text-primary/70" : "text-muted-foreground",
                      )}
                    >
                      {preset.description}
                    </span>
                  </button>
                );
              })}
            </div>,
            document.body,
          )}
      </div>
    </>
  );
}

export function PresentationChatPanel({
  messages,
  setMessages,
  messagesLoaded,
  onAssistantResponse,
  onPendingEdits,
  setChatError,
  onSendingChange,
  designStyleRef,
  fontPairRef,
  onResizeSlides,
  pendingPrompt,
  onPromptConsumed,
  messagesCollapsed,
}: {
  messages: SubagentMessage[];
  setMessages: React.Dispatch<React.SetStateAction<SubagentMessage[]>>;
  messagesLoaded: boolean;
  onAssistantResponse: () => void;
  onPendingEdits: (edits: unknown[]) => void;
  setChatError: (error: string | null) => void;
  onSendingChange?: (sending: boolean) => void;
  designStyleRef: React.RefObject<string>;
  fontPairRef: React.RefObject<string>;
  onResizeSlides: (width: number, height: number) => void;
  pendingPrompt?: string | null;
  onPromptConsumed?: () => void;
  messagesCollapsed: boolean;
}) {
  const workspaceId = useWorkspaceId();
  const [extracting, setExtracting] = useState(false);

  const chat = useSubagentChat({
    subagentId: PRESENTATION_SPECIALIST_ID,
    workspaceId,
    messages,
    setMessages,
    messagesLoaded,
    placeholder: "Describe the changes you want...",
    onAssistantResponse,
    onPendingEdits,
    extraPayload: () => {
      const doc = useDocumentEditorStore.getState().document;
      const refText = useDocumentEditorStore.getState().referenceText;
      const refName = useDocumentEditorStore.getState().referenceName;
      const editingIdx = useDocumentEditorStore.getState().editingSlideIndex;
      const selectedSlides = editingIdx !== null ? [editingIdx] : [];

      let documentContext: string;
      if (!doc && refText) {
        documentContext = [
          "No working document loaded yet. The user has provided a reference document.",
          "When the user asks you to create content, use the appropriate actions.",
          "",
          `--- REFERENCE DOCUMENT: ${refName} ---`,
          refText,
          "--- END REFERENCE ---",
        ].join("\n");
      } else if (doc) {
        documentContext = getDocumentContext(
          doc.name,
          doc.type,
          doc.content,
          doc.changes.length,
          refName,
          refText,
          selectedSlides.length > 0 ? selectedSlides : undefined,
        );
      } else {
        documentContext = "No document loaded.";
      }

      return {
        documentContext,
        presentationName: doc?.name,
        slideCount: (doc?.content as PptxContent | undefined)?.slides?.length,
        referenceName: refName,
        referenceText: refText,
        selectedSlideIndices: selectedSlides.length > 0 ? selectedSlides : undefined,
        slideDimensions: (doc?.content as PptxContent | undefined)?.slideDimensions,
        designStyle: designStyleRef.current,
        fontPair: fontPairRef.current,
      };
    },
  });

  useEffect(() => {
    setChatError(chat.sendError || null);
  }, [chat.sendError, setChatError]);

  useEffect(() => {
    onSendingChange?.(chat.sending);
  }, [chat.sending, onSendingChange]);

  const sendRef = useRef(chat.handleSendMessage);
  sendRef.current = chat.handleSendMessage;
  const consumeRef = useRef(onPromptConsumed);
  consumeRef.current = onPromptConsumed;
  const ready = !chat.sending && messagesLoaded;
  useEffect(() => {
    if (!pendingPrompt || !ready) return;
    void sendRef.current(pendingPrompt);
    consumeRef.current?.();
  }, [pendingPrompt, ready]);

  const extractDocuments = useCallback(
    async (files: File[]) => {
      setExtracting(true);
      try {
        for (const file of files) {
          const body = await uploadBodyFromFile(file);
          const data = await extractTextFromFile(body);
          chat.chatProps.onAddFileReference?.({
            id: `file-${Date.now()}-${file.name}`,
            name: data.name,
            content: data.text,
          });
        }
      } catch (err) {
        console.error("[PresentationEditor] File extraction failed:", err);
      } finally {
        setExtracting(false);
      }
    },
    [chat.chatProps.onAddFileReference],
  );

  const handleInterceptFiles = useCallback(
    (files: File[]) => {
      const documents = files.filter((file) => !file.type.startsWith("image/"));
      const images = files.filter((file) => file.type.startsWith("image/"));
      if (!documents.length) return false;

      void extractDocuments(documents);
      if (images.length) {
        void chat.chatProps.onAttachImages(images, "picker");
      }
      return true;
    },
    [chat.chatProps.onAttachImages, extractDocuments],
  );

  const handleQualityReview = useCallback(() => {
    const doc = useDocumentEditorStore.getState().document;
    if (!doc) return;
    const pptx = doc.content as PptxContent;
    const result = evaluatePresentationQuality(pptx, pptx.slideDimensions);
    if (result.ok) {
      void chat.handleSendMessage(
        "Review the presentation for design quality. Check typography, spacing, color consistency, and visual hierarchy. Fix any issues you find.",
      );
    } else {
      void chat.handleSendMessage(result.repairUserMessage);
    }
  }, [chat.handleSendMessage]);

  const extraControls = (
    <>
      {extracting && (
        <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground mr-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Extracting text…</span>
        </div>
      )}
      <PresentationInputControls
        onResize={onResizeSlides}
        sending={chat.sending}
        onQualityReview={handleQualityReview}
      />
    </>
  );

  return (
    <SubagentChat
      {...chat.chatProps}
      inputLayout="docked"
      messagesCollapsed={messagesCollapsed}
      extraInputControls={extraControls}
      onInterceptFiles={handleInterceptFiles}
    />
  );
}
