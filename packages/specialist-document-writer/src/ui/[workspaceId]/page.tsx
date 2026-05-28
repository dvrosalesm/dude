"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import { useDocumentWriterStore } from "@dude/specialist-document-writer/store";
import { useSpecialistWorkspaceLoader } from "@dude/chat/specialists/hooks/use-specialist-workspace-loader";
import { updateWorkspaceById } from "@dude/workspaces";
import { EditorLayout } from "./components/editor-layout";
import type { WriterWorkspace } from "./types";
import type { WriterDocumentContent } from "@dude/specialist-document-writer/types";
import { applyDocumentEdits } from "@dude/specialist-document-writer/lib/apply-document-edits";
import { attachDocumentWriterDebugHooks } from "../dev-debug";

export default function DocumentWriterWorkspacePage() {
  const [processing, setProcessing] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WriterWorkspace | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store actions
  const setBlocks = useDocumentWriterStore((s) => s.setBlocks);
  const setTitle = useDocumentWriterStore((s) => s.setTitle);
  const setDescription = useDocumentWriterStore((s) => s.setDescription);
  const setTemplate = useDocumentWriterStore((s) => s.setTemplate);
  const loadContent = useDocumentWriterStore((s) => s.loadContent);
  const reset = useDocumentWriterStore((s) => s.reset);

  const applyConfig = useCallback(
    (config: Record<string, unknown>, meta: { workspace: Record<string, unknown> }) => {
      const documentContent = config.documentContent as { blocks?: unknown[]; title?: string } | undefined;
      const blockCount = Array.isArray(documentContent?.blocks) ? documentContent.blocks.length : 0;
      // #region agent log
      fetch('http://127.0.0.1:7884/ingest/44760fdd-2433-4958-be9a-fbf49e3e279f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'099559'},body:JSON.stringify({sessionId:'099559',location:'page.tsx:applyConfig',message:'applyConfig documentContent',data:{workspaceId:meta.workspaceId,blockCount,hasTitle:typeof documentContent?.title==='string',storeBlocksBefore:useDocumentWriterStore.getState().blocks.length},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      setWorkspace(meta.workspace as unknown as WriterWorkspace);
      if (typeof config.description === "string") setDescription(config.description);
      if (typeof config.template === "string") setTemplate(config.template as never);
      if (Array.isArray(config.contextDocuments)) {
        const storeState = useDocumentWriterStore.getState();
        if (storeState.contextDocuments.length === 0) {
          for (const doc of config.contextDocuments as unknown[]) {
            useDocumentWriterStore.getState().addContextDocument(doc as never);
          }
        }
      }
      if (config.pageLayout) {
        useDocumentWriterStore.getState().setPageLayout(config.pageLayout as never);
      }
      if (documentContent && typeof documentContent === "object") {
        const blocks = Array.isArray(documentContent.blocks)
          ? documentContent.blocks
          : [];
        const title =
          typeof documentContent.title === "string" ? documentContent.title : "";
        if (blocks.length > 0 || title) {
          loadContent({ blocks, title } as WriterDocumentContent);
          // #region agent log
          fetch('http://127.0.0.1:7884/ingest/44760fdd-2433-4958-be9a-fbf49e3e279f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'099559'},body:JSON.stringify({sessionId:'099559',location:'page.tsx:applyConfig:loadContent',message:'loadContent from server config',data:{blockCount:blocks.length,title},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
          // #endregion
        }
      }
    },
    [setDescription, setTemplate, loadContent],
  );

  useEffect(() => {
    if (import.meta.env.DEV) attachDocumentWriterDebugHooks();
  }, []);

  const {
    workspaceId,
    loading,
    error,
    chatMessages,
    setChatMessages,
    chatMessagesLoaded: messagesLoaded,
    refreshWorkspace,
    handleRename: rawHandleRename,
  } = useSpecialistWorkspaceLoader({
    defaultName: "Document",
    applyConfig,
    resetState: () => reset(),
  });

  const saveConfigurations = useCallback(
    (updates: Record<string, unknown>) => {
      if (!workspaceId) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await updateWorkspaceById(workspaceId, { configurations: updates });
        } catch (err) {
          console.error("[DOCUMENT-WRITER] Save failed:", err);
        }
      }, 800);
    },
    [workspaceId],
  );

  const handleRename = useCallback(
    async (name: string) => {
      await rawHandleRename(name);
      setWorkspace((prev) => (prev ? { ...prev, name } : prev));
    },
    [rawHandleRename],
  );

  // -------------------------------------------------------------------------
  // Apply AI-suggested edits to the document blocks
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!chatSending) return;
    void refreshWorkspace();
    const interval = setInterval(() => void refreshWorkspace(), 2000);
    return () => clearInterval(interval);
  }, [chatSending, refreshWorkspace]);

  const applySuggestedEdits = useCallback(
    (edits: unknown[]) => {
      const store = useDocumentWriterStore.getState();
      const content = applyDocumentEdits(
        { blocks: store.blocks, title: store.title },
        edits,
      );
      setBlocks(content.blocks);
      setTitle(content.title);
      saveConfigurations({ documentContent: content });
    },
    [setBlocks, setTitle, saveConfigurations],
  );

  // -------------------------------------------------------------------------
  // Handle edits from tool calls (real-time during polling)
  // -------------------------------------------------------------------------

  const handlePendingEdits = useCallback(
    (edits: unknown[]) => {
      // #region agent log
      fetch('http://127.0.0.1:7884/ingest/44760fdd-2433-4958-be9a-fbf49e3e279f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'099559'},body:JSON.stringify({sessionId:'099559',location:'page.tsx:handlePendingEdits',message:'pending edits received',data:{editCount:edits.length,actions:edits.slice(0,5).map((e)=>typeof e==='object'&&e&&'action' in e?String((e as {action?:unknown}).action):'unknown'),storeBlocksBefore:useDocumentWriterStore.getState().blocks.length},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      setProcessing(true);
      try {
        applySuggestedEdits(edits);
        // #region agent log
        fetch('http://127.0.0.1:7884/ingest/44760fdd-2433-4958-be9a-fbf49e3e279f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'099559'},body:JSON.stringify({sessionId:'099559',location:'page.tsx:handlePendingEdits:after',message:'after applySuggestedEdits',data:{storeBlocksAfter:useDocumentWriterStore.getState().blocks.length,title:useDocumentWriterStore.getState().title},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      } catch (err) {
        console.error("[DOCUMENT-WRITER] Failed to apply edits:", err);
        setChatError(
          err instanceof Error ? err.message : "Failed to apply document edits",
        );
      } finally {
        setProcessing(false);
      }
    },
    [applySuggestedEdits],
  );

  // Called after assistant finishes — no-op since edits are applied via onPendingEdits
  const handleAssistantResponse = useCallback(async () => {
    try {
      await refreshWorkspace();
      const store = useDocumentWriterStore.getState();
      if (store.blocks.length > 0) {
        saveConfigurations({
          documentContent: { blocks: store.blocks, title: store.title },
        });
      }
    } catch (err) {
      console.warn("[DOCUMENT-WRITER] Failed to reload after assistant:", err);
    }
  }, [refreshWorkspace, saveConfigurations]);

  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------

  const handleSave = useCallback(
    (updates: Record<string, unknown>) => {
      saveConfigurations(updates);
    },
    [saveConfigurations],
  );

  function handleBack() {
    const store = useDocumentWriterStore.getState();
    if (store.blocks.length > 0) {
      saveConfigurations({
        documentContent: { blocks: store.blocks, title: store.title },
      });
    }
    window.history.back();
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-0 bg-[#f0f0f0]">
        <BrailleSpinner className="text-2xl text-muted-foreground/60" />
      </div>
    );
  }

  if (error && !workspace) {
    return (
      <div className="flex items-center justify-center h-full min-h-0 bg-[#f0f0f0]">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <EditorLayout
      workspace={workspace}
      onRename={handleRename}
      processing={processing}
      messages={chatMessages}
      setMessages={setChatMessages}
      messagesLoaded={messagesLoaded}
      onAssistantResponse={handleAssistantResponse}
      onPendingEdits={handlePendingEdits}
      chatError={chatError}
      setChatError={setChatError}
      onSave={handleSave}
      onBack={handleBack}
      onChatSendingChange={setChatSending}
    />
  );
}
