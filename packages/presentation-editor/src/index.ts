export * from "./types/document-editor.js";
export { useDocumentEditorStore, type SelectedShapeId } from "./store/use-document-editor-store.js";
export { applyEditsToContent, applyPendingEdits, createEmptyPptxContent } from "./lib/document-editor/apply-edits.js";
export { getDocumentContext } from "./lib/presentation-editor/document-context.js";
