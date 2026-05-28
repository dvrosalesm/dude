"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDocumentEditorStore } from "@dude/presentation-editor/store";
import { resizePptxSlides } from "@dude/presentation-editor/lib/document-editor-actions";
import { applyEditsToContent } from "@dude/presentation-editor/document-editor/apply-edits";
import { useSubagentWorkspaceLoader } from "@dude/chat/subagents/hooks/use-subagent-workspace-loader";
import type { SubagentMessage } from "@dude/chat/subagents/types";
import { SetupScreen } from "./components/setup-screen";
import { EditorLayout } from "./components/editor-layout";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import type { DocumentWorkspace, DocumentRevision, EditorMode } from "./types";
import type { DocumentContent, DocumentType, PptxContent } from "@dude/presentation-editor/types";
import { DEFAULT_DESIGN_STYLE } from "@dude/presentation-editor/lib/design-styles";
import { DEFAULT_FONT_PAIR } from "@dude/presentation-editor/lib/font-pairs";
import { createPresentation, patchWorkspaceById } from "@dude/workspaces";
import {
  applyPresentationConfig,
  generateRevisionId,
  normalizeHtmlShaderContent,
  stripForSave,
  stripRevisionsForStorage,
  trimRevisions,
} from "./lib/presentation-workspace";

function normalizeChatMessages(raw: unknown[]): SubagentMessage[] {
  return raw
    .filter((m): m is { role: "user" | "assistant"; message: string } => {
      const row = m as { role?: unknown; message?: unknown };
      return (
        (row.role === "user" || row.role === "assistant") &&
        typeof row.message === "string"
      );
    })
    .map((m) => ({ role: m.role, message: m.message }));
}

export default function DocumentEditorWorkspacePage() {
  const [workspace, setWorkspace] = useState<DocumentWorkspace | null>(null);
  const [mode, setMode] = useState<EditorMode>("setup");

  const revisionsRef = useRef<DocumentRevision[]>([]);
  const chatMessagesRef = useRef<SubagentMessage[]>([]);

  const [chatError, setChatError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const docMetaRef = useRef<{ name: string; type: DocumentType }>({
    name: "Document",
    type: "pptx",
  });

  const [designStyle, setDesignStyle] = useState<string>(DEFAULT_DESIGN_STYLE);
  const designStyleRef = useRef<string>(DEFAULT_DESIGN_STYLE);
  useEffect(() => {
    designStyleRef.current = designStyle;
  }, [designStyle]);

  const [fontPair, setFontPair] = useState<string>(DEFAULT_FONT_PAIR);
  const fontPairRef = useRef<string>(DEFAULT_FONT_PAIR);
  useEffect(() => {
    fontPairRef.current = fontPair;
  }, [fontPair]);

  const clearDocument = useDocumentEditorStore((s) => s.clearDocument);
  const loadDocument = useDocumentEditorStore((s) => s.loadDocument);
  const setReference = useDocumentEditorStore((s) => s.setReference);
  const referenceText = useDocumentEditorStore((s) => s.referenceText);
  const referenceName = useDocumentEditorStore((s) => s.referenceName);

  const skipAutoSaveRef = useRef(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const updateRevisions = useCallback(
    (updater: DocumentRevision[] | ((prev: DocumentRevision[]) => DocumentRevision[])) => {
      const prev = revisionsRef.current;
      revisionsRef.current = typeof updater === "function" ? updater(prev) : updater;
    },
    [],
  );

  const applyConfig = useCallback(
    (config: Record<string, unknown>, meta: { workspace: Record<string, unknown> }) => {
      setWorkspace(meta.workspace as DocumentWorkspace);

      if (typeof config.designStyle === "string") {
        setDesignStyle(config.designStyle);
      }
      if (typeof config.fontPair === "string") {
        setFontPair(config.fontPair);
      }

      applyPresentationConfig(config, {
        loadDocument,
        setReference,
        setMode,
        updateRevisions: (revisions) => {
          revisionsRef.current = revisions;
        },
        setDocMeta: (meta) => {
          docMetaRef.current = meta;
        },
      });
    },
    [loadDocument, setReference],
  );

  const {
    workspaceId,
    loading,
    error,
    chatMessages,
    setChatMessages,
    chatMessagesLoaded,
    refreshWorkspace,
    handleRename: renameWorkspace,
  } = useSubagentWorkspaceLoader({
    defaultName: "Presentation",
    applyConfig,
    resetState: () => {
      clearDocument();
      revisionsRef.current = [];
      setMode("setup");
      setDesignStyle(DEFAULT_DESIGN_STYLE);
      setFontPair(DEFAULT_FONT_PAIR);
    },
    normalizeMessages: normalizeChatMessages,
  });

  chatMessagesRef.current = chatMessages;

  useEffect(() => {
    if (!chatSending) return;
    void refreshWorkspace();
    const interval = setInterval(() => void refreshWorkspace(), 2000);
    return () => clearInterval(interval);
  }, [chatSending, refreshWorkspace]);

  const saveConfigurations = useCallback(
    async (updates: Record<string, unknown>) => {
      if (!workspaceId) return;
      try {
        await patchWorkspaceById(workspaceId, { configurations: updates });
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("[DOCUMENT-EDITOR] Save failed:", err);
      }
    },
    [workspaceId],
  );

  const handleSetDesignStyle = useCallback(
    (styleKey: string) => {
      designStyleRef.current = styleKey;
      setDesignStyle(styleKey);
      void saveConfigurations({ designStyle: styleKey });
    },
    [saveConfigurations],
  );

  const handleSetFontPair = useCallback(
    (pairKey: string) => {
      fontPairRef.current = pairKey;
      setFontPair(pairKey);
      void saveConfigurations({ fontPair: pairKey });
    },
    [saveConfigurations],
  );

  const handleManualSave = useCallback(async () => {
    if (skipAutoSaveRef.current) return;
    const doc = useDocumentEditorStore.getState().document;
    if (!doc || !docMetaRef.current) return;
    await saveConfigurations({
      documentContent: stripForSave(doc.content),
      documentType: doc.type,
      documentName: doc.name,
      revisions: stripRevisionsForStorage(revisionsRef.current),
    });
  }, [saveConfigurations]);

  const addRevision = useCallback(
    (prompt: string) => {
      const doc = useDocumentEditorStore.getState().document;
      if (!doc) return;

      const current = revisionsRef.current;
      const newRevision: DocumentRevision = {
        id: generateRevisionId(),
        label: `Revision ${current.length + 1}`,
        content: JSON.parse(JSON.stringify(doc.content)),
        changes: [...doc.changes],
        prompt,
        createdAt: new Date().toISOString(),
      };

      const updated = trimRevisions([newRevision, ...current]);
      updateRevisions(updated);

      void saveConfigurations({
        documentContent: stripForSave(doc.content),
        documentType: doc.type,
        documentName: doc.name,
        revisions: stripRevisionsForStorage(updated),
      });
    },
    [saveConfigurations, updateRevisions],
  );

  const handlePendingEdits = useCallback((edits: unknown[]) => {
    if (edits.length === 0) return;
    const currentDoc = useDocumentEditorStore.getState().document;
    if (!currentDoc) return;

    skipAutoSaveRef.current = true;
    const { content: updated } = applyEditsToContent(
      currentDoc.content as PptxContent,
      edits as Parameters<typeof applyEditsToContent>[1],
    );
    useDocumentEditorStore.getState().setContent(
      normalizeHtmlShaderContent(updated) as PptxContent,
    );
    setMode("editor");
  }, []);

  const handleAssistantResponse = useCallback(async () => {
    skipAutoSaveRef.current = true;
    try {
      await refreshWorkspace();
      if (useDocumentEditorStore.getState().document) {
        const lastUser = chatMessagesRef.current.filter((m) => m.role === "user").at(-1);
        addRevision(lastUser?.message || "AI edit");
        useDocumentEditorStore.getState().clearChanges();
      }
    } catch (err) {
      console.warn("[PPTX-EDITOR] Failed to reload document after edits:", err);
    } finally {
      skipAutoSaveRef.current = false;
    }
  }, [addRevision, refreshWorkspace]);

  async function handleStart(params: {
    prompt: string;
    action: "create";
    documentType?: DocumentType;
    slideDimensions?: { width: number; height: number };
  }) {
    setSetupLoading(true);
    setSetupError(null);

    designStyleRef.current = designStyle;
    fontPairRef.current = fontPair;

    try {
      const data = await createPresentation({
        type: params.documentType,
        slideWidth: params.slideDimensions?.width,
        slideHeight: params.slideDimensions?.height,
      });
      const docName = data.name;
      const docType = data.type as DocumentType;
      const docContent = data.content as DocumentContent;

      const normalizedContent = normalizeHtmlShaderContent(docContent);
      loadDocument(docName, docType, normalizedContent);
      docMetaRef.current = { name: docName, type: docType };

      const initialRevision: DocumentRevision = {
        id: generateRevisionId(),
        label: "Initial",
        content: JSON.parse(JSON.stringify(normalizedContent)),
        changes: [],
        prompt: "Document created",
        createdAt: new Date().toISOString(),
      };
      updateRevisions([initialRevision]);

      await saveConfigurations({
        hasDocument: true,
        documentName: docName,
        documentType: docType,
        documentContent: stripForSave(normalizedContent),
        referenceName: referenceName,
        referenceText: referenceText,
        revisions: stripRevisionsForStorage([initialRevision]),
        designStyle,
        fontPair,
      });

      setMode("editor");

      const prompt = params.prompt.trim();
      if (prompt) {
        setPendingPrompt(prompt);
      }
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSetupLoading(false);
    }
  }

  const handleResizeSlides = useCallback(
    async (width: number, height: number) => {
      setChatError(null);
      try {
        const result = resizePptxSlides(width, height);
        if (result.success) {
          addRevision("Resize slides");
          useDocumentEditorStore.getState().clearChanges();
        } else if (!result.success && "error" in result) {
          setChatError(result.error);
        }
      } catch (err) {
        setChatError(err instanceof Error ? err.message : "Failed to resize slides");
      }
    },
    [addRevision],
  );

  const handleRename = useCallback(
    async (name: string) => {
      await renameWorkspace(name);
      setWorkspace((prev) => (prev ? { ...prev, name } : prev));
    },
    [renameWorkspace],
  );

  useEffect(() => {
    let initial = true;
    const unsub = useDocumentEditorStore.subscribe((state, prevState) => {
      if (initial) {
        initial = false;
        return;
      }
      if (state.document === prevState?.document) return;
      if (skipAutoSaveRef.current) return;
      setHasUnsavedChanges(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void handleManualSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleManualSave]);

  function handleBack() {
    window.history.back();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-0 bg-muted">
        <BrailleSpinner />
      </div>
    );
  }

  if (error && !workspace) {
    return (
      <div className="flex items-center justify-center h-full min-h-0 bg-muted">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (mode === "setup") {
    return (
      <SetupScreen
        onStart={handleStart}
        loading={setupLoading}
        error={setupError}
        onBack={revisionsRef.current.length > 0 ? () => setMode("editor") : handleBack}
      />
    );
  }

  return (
    <EditorLayout
      workspace={workspace}
      chatOpen={chatOpen}
      onChatOpenChange={setChatOpen}
      messages={chatMessages}
      setMessages={setChatMessages}
      messagesLoaded={chatMessagesLoaded}
      onAssistantResponse={handleAssistantResponse}
      onPendingEdits={handlePendingEdits}
      setChatError={setChatError}
      chatError={chatError}
      onChatSendingChange={setChatSending}
      designStyle={designStyle}
      onDesignStyleChange={handleSetDesignStyle}
      fontPair={fontPair}
      onFontPairChange={handleSetFontPair}
      onResizeSlides={handleResizeSlides}
      pendingPrompt={pendingPrompt}
      onPromptConsumed={() => setPendingPrompt(null)}
      onBack={handleBack}
      onSave={handleManualSave}
      hasUnsavedChanges={hasUnsavedChanges}
      onRename={handleRename}
    />
  );
}
