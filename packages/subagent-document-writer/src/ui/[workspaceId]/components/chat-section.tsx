"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SubagentChat } from "@dude/chat/subagents/subagent-chat";
import { useSubagentChat } from "@dude/chat/subagents/hooks/use-subagent-chat";
import type { SubagentMessage } from "@dude/chat/subagents/types";
import { useDocumentWriterStore } from "@dude/subagent-document-writer/store";
import { useWorkspaceId } from "@dude/subagent-params";
import { extractTextFromFile, uploadBodyFromFile } from "@dude/workspaces";

export function ChatSection({
  messages,
  setMessages,
  messagesLoaded,
  onAssistantResponse,
  onPendingEdits,
  setChatError,
  onSendingChange,
}: {
  messages: SubagentMessage[];
  setMessages: React.Dispatch<React.SetStateAction<SubagentMessage[]>>;
  messagesLoaded: boolean;
  onAssistantResponse: () => void;
  onPendingEdits: (edits: unknown[]) => void;
  setChatError: (error: string | null) => void;
  onSendingChange?: (sending: boolean) => void;
}) {
  const workspaceId = useWorkspaceId();
  const [extracting, setExtracting] = useState(false);

  const chat = useSubagentChat({
    subagentId: "document-writer",
    workspaceId,
    messages,
    setMessages,
    messagesLoaded,
    bootMessage: () => {
      const store = useDocumentWriterStore.getState();
      const hasContent = store.blocks.length > 0;
      if (hasContent) {
        return "The user has an existing document loaded. Greet them briefly and ask what changes or additions they'd like to make.";
      }
      return "Greet the user briefly. Ask what type of document they'd like to create — for example a proposal, report, guide, spec, etc. Ask who the audience is and any key points they want to cover. Keep it conversational and concise — 2-3 questions max.";
    },
    wakingUpLabel: "Waking up your document writer...",
    placeholder: "Describe what to write or change...",
    onAssistantResponse,
    onPendingEdits,
    extraPayload: () => {
      const store = useDocumentWriterStore.getState();

      const parts: string[] = [];
      if (store.title) parts.push(`Document title: ${store.title}`);
      if (store.blocks.length > 0) {
        parts.push("", "--- CURRENT DOCUMENT BLOCKS ---");
        for (const block of store.blocks) {
          parts.push(`[${block.type}] (id: ${block.id})`);
          parts.push(block.content || "(empty)");
          if (block.meta) parts.push(`meta: ${JSON.stringify(block.meta)}`);
          parts.push("");
        }
        parts.push("--- END DOCUMENT ---");
      } else {
        parts.push("", "Document is empty — no blocks yet.");
      }

      return {
        documentContext: parts.join("\n"),
        description: store.description,
        template: store.template,
        contextDocuments: store.contextDocuments.map((d) => ({
          name: d.name,
          text: d.text,
        })),
      };
    },
  });

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
        console.error("[DocumentWriter] File extraction failed:", err);
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

  // Sync errors up
  useEffect(() => {
    setChatError(chat.sendError || null);
  }, [chat.sendError, setChatError]);

  // Bubble up the agent's sending state so the parent can show a generating
  // overlay over the document while the AI is producing edits.
  useEffect(() => {
    onSendingChange?.(chat.sending);
  }, [chat.sending, onSendingChange]);

  const extraControls = extracting ? (
    <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground mr-1">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>Reading file…</span>
    </div>
  ) : null;

  return (
    <SubagentChat
      {...chat.chatProps}
      extraInputControls={extraControls}
      onInterceptFiles={handleInterceptFiles}
    />
  );
}
