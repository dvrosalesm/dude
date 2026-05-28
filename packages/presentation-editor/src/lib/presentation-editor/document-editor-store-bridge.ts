import { useDocumentEditorStore } from "@dude/presentation-editor/store";
import type { PptxContent } from "@dude/presentation-editor/types";

export function getEditorDocument() {
  return useDocumentEditorStore.getState().document;
}

export function getPptxContent(): PptxContent | null {
  const doc = getEditorDocument();
  if (!doc || doc.type !== "pptx") return null;
  return doc.content as PptxContent;
}

export function commitPptxContent(content: PptxContent) {
  useDocumentEditorStore.getState().setContent({ ...content, fullHtml: undefined });
}

export function recordDocumentChange(change: Parameters<
  ReturnType<typeof useDocumentEditorStore.getState>["addChange"]
>[0]) {
  useDocumentEditorStore.getState().addChange(change);
}

export function clearDocumentChanges() {
  useDocumentEditorStore.getState().clearChanges();
}
