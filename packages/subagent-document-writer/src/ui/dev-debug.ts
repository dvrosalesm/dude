/**
 * Dev-only hooks for browser/CDP probes (see scripts/ui-harness/).
 * Attached to `window.__DUDE_DW_DEBUG__` when import.meta.env.DEV is true.
 */

import { useDocumentWriterStore } from "../store";

export type DocumentWriterDebugSnapshot = {
  blockCount: number;
  title: string;
  blocksPreview: string;
  editorTextLength: number | null;
};

export function snapshotDocumentWriterState(): DocumentWriterDebugSnapshot {
  const store = useDocumentWriterStore.getState();
  const editorEl = document.querySelector(".tiptap");
  const editorText = editorEl?.textContent?.trim() ?? "";
  return {
    blockCount: store.blocks.length,
    title: store.title,
    blocksPreview: store.blocks
      .slice(0, 3)
      .map((b) => `${b.type}:${(b.content || "").slice(0, 40)}`)
      .join(" | "),
    editorTextLength: editorEl ? editorText.length : null,
  };
}

export function attachDocumentWriterDebugHooks(): void {
  if (typeof window === "undefined") return;
  const w = window as Window & {
    __DUDE_DW_DEBUG__?: {
      snapshot: () => DocumentWriterDebugSnapshot;
      getStore: () => ReturnType<typeof useDocumentWriterStore.getState>;
    };
  };
  w.__DUDE_DW_DEBUG__ = {
    snapshot: snapshotDocumentWriterState,
    getStore: () => useDocumentWriterStore.getState(),
  };
}
