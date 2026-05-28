import { useDocumentEditorStore } from "@dude/presentation-editor/store";
import type { PptxContent } from "@dude/presentation-editor/types";

export type PresentationEditorDebugSnapshot = {
  slideCount: number;
  documentName: string | null;
  selectedSlideIndices: number[];
  hasPresentationHtml: boolean;
};

export function snapshotPresentationEditor(): PresentationEditorDebugSnapshot {
  const state = useDocumentEditorStore.getState();
  const doc = state.document;
  const pptx = doc?.content as PptxContent | undefined;
  return {
    slideCount: Array.isArray(pptx?.slides) ? pptx.slides.length : 0,
    documentName: doc?.name ?? null,
    selectedSlideIndices: state.selectedSlideIndices,
    hasPresentationHtml: Boolean(state.presentationHtml),
  };
}

export function attachPresentationEditorDebugHooks(): void {
  if (typeof window === "undefined") return;
  (window as Window & { __DUDE_PE_DEBUG__?: { snapshot: () => PresentationEditorDebugSnapshot } }).__DUDE_PE_DEBUG__ =
    {
      snapshot: snapshotPresentationEditor,
    };
}
