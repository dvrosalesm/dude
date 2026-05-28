"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { useWorkspaceId } from "@dude/subagent-params";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Image } from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { WriterToolbar } from "./writer-toolbar";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import { useDocumentWriterStore } from "@dude/subagent-document-writer/store";
import {
  blocksToTiptapDoc,
  tiptapDocToBlocks,
} from "../lib/tiptap-converters";
import { AgentWriterAutocompleteExtension } from "../lib/agent-autocomplete-extension";
import { canReachWriterAutocompleteGateway } from "../lib/fetch-writer-autocomplete";

type WriterCanvasProps = {
  processing: boolean;
  agentBusy?: boolean;
  showChat: boolean;
  onToggleChat: () => void;
};

export function WriterCanvas({
  processing,
  agentBusy = false,
  showChat,
  onToggleChat,
}: WriterCanvasProps) {
  const workspaceId = useWorkspaceId() ?? "";
  const blocks = useDocumentWriterStore((s) => s.blocks);
  const title = useDocumentWriterStore((s) => s.title);
  const setTitle = useDocumentWriterStore((s) => s.setTitle);
  const setBlocks = useDocumentWriterStore((s) => s.setBlocks);

  // Ref to track programmatic updates and prevent feedback loops
  const updatingRef = useRef(false);
  // Tracks whether the latest blocks change came from user typing in the editor
  const userEditRef = useRef(false);
  const agentBusyRef = useRef(agentBusy);
  agentBusyRef.current = agentBusy || processing;

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: true,
        blockquote: true,
        bulletList: true,
        orderedList: true,
        horizontalRule: true,
      }),
      Placeholder.configure({
        placeholder:
          "Start writing or use the prompt bar to generate content...",
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      AgentWriterAutocompleteExtension.configure({
        workspaceId,
        title,
        enabled: () => Boolean(workspaceId) && !agentBusyRef.current,
        debounceMs: 500,
        minPrefixLength: 8,
      }),
    ],
    [workspaceId, title],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: blocksToTiptapDoc(blocks, title),
    onUpdate: ({ editor: ed }) => {
      if (updatingRef.current) return;
      userEditRef.current = true;
      const { blocks: newBlocks } = tiptapDocToBlocks(ed.getJSON());
      setBlocks(newBlocks);
    },
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-2",
      },
    },
  });

  // Track AI-driven content changes for subtle highlight animation
  const [aiHighlight, setAiHighlight] = useState(false);
  const prevBlocksRef = useRef(blocks);

  // When blocks change externally (AI edits), push into Tiptap
  useEffect(() => {
    if (!editor || updatingRef.current) return;

    // Skip sync when the change originated from user typing in the editor
    if (userEditRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7884/ingest/44760fdd-2433-4958-be9a-fbf49e3e279f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'099559'},body:JSON.stringify({sessionId:'099559',location:'writer-canvas.tsx:sync',message:'skipped sync (userEdit)',data:{blockCount:blocks.length},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      userEditRef.current = false;
      prevBlocksRef.current = blocks;
      return;
    }

    const editorBlocks = tiptapDocToBlocks(editor.getJSON()).blocks;
    // Only update if blocks actually differ
    if (JSON.stringify(editorBlocks) !== JSON.stringify(blocks)) {
      // #region agent log
      fetch('http://127.0.0.1:7884/ingest/44760fdd-2433-4958-be9a-fbf49e3e279f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'099559'},body:JSON.stringify({sessionId:'099559',location:'writer-canvas.tsx:sync',message:'pushing blocks to tiptap',data:{storeBlockCount:blocks.length,editorBlockCount:editorBlocks.length,processing},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      updatingRef.current = true;
      try {
        editor.commands.setContent(blocksToTiptapDoc(blocks, title));
      } catch (err) {
        console.error("[DOCUMENT-WRITER] Failed to sync editor content:", err);
      } finally {
        updatingRef.current = false;
      }

      // Flash subtle highlight when AI changes arrive
      if (prevBlocksRef.current !== blocks && processing) {
        setAiHighlight(true);
        setTimeout(() => setAiHighlight(false), 1200);
      }
    }
    prevBlocksRef.current = blocks;
  }, [blocks, editor, title, processing]);

  return (
    <div
      data-testid="dw-writer-canvas"
      className="flex-1 overflow-auto bg-card print:overflow-visible print:h-auto print:flex-none"
    >
      {/* Toolbar */}
      {editor && <WriterToolbar editor={editor} showChat={showChat} onToggleChat={onToggleChat} />}

      <div className="mx-auto max-w-3xl px-4 pt-8 pb-40 writer-print-content print:max-w-none print:pb-0 print:pt-0">

        {/* Tiptap editor */}
        <div className={aiHighlight ? "writer-ai-highlight" : ""}>
          <EditorContent editor={editor} />
          {editor &&
            workspaceId &&
            !agentBusy &&
            canReachWriterAutocompleteGateway() && (
            <p className="writer-autocomplete-hint print:hidden">
              Inline suggestions use your configured agent runner — keep typing, then Tab to
              accept or Esc to dismiss.
            </p>
          )}
        </div>

        <style>{`
          .writer-ai-highlight .tiptap > * {
            animation: writer-block-in 1.2s ease-out;
          }
          @keyframes writer-block-in {
            0% { background-color: rgba(251, 183, 107, 0.08); }
            100% { background-color: transparent; }
          }
        `}</style>
        <style>{`
          .tiptap blockquote.callout {
            border-left: 4px solid;
            border-radius: 6px;
            padding: 12px 16px;
            margin: 12px 0;
          }
          .tiptap blockquote.callout-info {
            border-color: #3b82f6;
            background: #eff6ff;
          }
          .tiptap blockquote.callout-warning {
            border-color: #f59e0b;
            background: #fffbeb;
          }
          .tiptap blockquote.callout-success {
            border-color: #10b981;
            background: #ecfdf5;
          }
          .tiptap blockquote.callout-error {
            border-color: #ef4444;
            background: #fef2f2;
          }
          .tiptap blockquote.callout-tip {
            border-color: #8b5cf6;
            background: #f5f3ff;
          }
          .tiptap mark {
            border-radius: 2px;
            padding: 1px 3px;
          }
          .writer-autocomplete-ghost {
            color: hsl(var(--muted-foreground) / 0.55);
            pointer-events: none;
            white-space: pre-wrap;
          }
          .writer-autocomplete-hint {
            font-size: 11px;
            color: hsl(var(--muted-foreground) / 0.7);
            margin-top: 6px;
          }
        `}</style>

        {processing && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm mt-4 print:hidden">
            <BrailleSpinner className="text-lg text-[#E7C59A]" />
            <span>Applying changes...</span>
          </div>
        )}
      </div>
    </div>
  );
}
