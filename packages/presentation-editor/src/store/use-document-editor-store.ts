import { create } from "zustand";
import type {
  DocumentState,
  DocumentContent,
  DocumentType,
  Change,
  Revision,
  PptxShapeTransform,
} from "@dude/presentation-editor/types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function assignSlideUids(content: DocumentContent): DocumentContent {
  const pptx = content as import("@dude/presentation-editor/types").PptxContent;
  if (!pptx.slides) return content;
  // Deduplicate: reassign any UIDs that appear more than once
  const seen = new Set<string>();
  return {
    ...pptx,
    slides: pptx.slides.map((s) => {
      if (s.uid && !seen.has(s.uid)) {
        seen.add(s.uid);
        return s;
      }
      const uid = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      seen.add(uid);
      return { ...s, uid };
    }),
  };
}

export type SelectedShapeId = { slideIndex: number; shapeIndex: number } | null;

interface DocumentEditorStore {
  document: DocumentState | null;
  isLoading: boolean;
  error: string | null;

  // Slide edit mode
  editingSlideIndex: number | null;
  selectedShapeId: SelectedShapeId;
  localShapeOverrides: Map<string, PptxShapeTransform>;
  enterSlideEditMode: (slideIndex: number) => void;
  exitSlideEditMode: () => void;
  selectShape: (slideIndex: number, shapeIndex: number) => void;
  clearShapeSelection: () => void;
  setLocalShapeTransform: (slideIndex: number, shapeIndex: number, transform: PptxShapeTransform) => void;
  clearLocalShapeOverrides: () => void;
  toggleShapeVisibility: (slideIndex: number, shapeIndex: number) => void;


  setDocument: (doc: DocumentState | null) => void;
  setContent: (content: DocumentContent) => void;
  setDocumentName: (name: string) => void;

  addChange: (change: Omit<Change, "id" | "timestamp">) => void;
  clearChanges: () => void;
  setChanges: (changes: Change[]) => void;

  /** Snapshot for rollback when changes were auto-applied; shown above the preview. */
  pendingRollback: { content: DocumentContent; changes: Change[] } | null;
  pendingRollbackCount: number;
  setPendingRollback: (content: DocumentContent, changes: Change[], count: number) => void;
  clearPendingRollback: () => void;
  acceptPendingRollback: () => void;
  rejectPendingRollback: () => void;

  revisions: Revision[];
  restoreRevision: (id: string) => void;

  selectedSlideIndices: number[];
  toggleSlideSelection: (index: number) => void;
  clearSlideSelection: () => void;

  reorderSlides: (fromIndex: number, toIndex: number) => void;
  deleteSlides: (indices: number[]) => void;

  presentationHtml: string | null;
  setPresentationHtml: (html: string | null) => void;
  showPresentation: boolean;
  setShowPresentation: (show: boolean) => void;

  referenceText: string | null;
  referenceName: string | null;
  setReference: (name: string, text: string) => void;
  clearReference: () => void;

  // Undo / Redo
  undoStack: DocumentContent[];
  redoStack: DocumentContent[];
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;

  loadDocument: (
    name: string,
    type: DocumentType,
    content: DocumentContent,
    originalFile?: File
  ) => void;
  clearDocument: () => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useDocumentEditorStore = create<DocumentEditorStore>((set) => ({
  document: null,
  isLoading: false,
  error: null,

  // Slide edit mode
  editingSlideIndex: null,
  selectedShapeId: null,
  localShapeOverrides: new Map(),
  enterSlideEditMode: (slideIndex) =>
    set({ editingSlideIndex: slideIndex, selectedShapeId: null, localShapeOverrides: new Map() }),
  exitSlideEditMode: () =>
    set({ editingSlideIndex: null, selectedShapeId: null, localShapeOverrides: new Map() }),
  selectShape: (slideIndex, shapeIndex) =>
    set({ selectedShapeId: { slideIndex, shapeIndex } }),
  clearShapeSelection: () => set({ selectedShapeId: null }),
  setLocalShapeTransform: (slideIndex, shapeIndex, transform) =>
    set((state) => {
      const key = `${slideIndex}:${shapeIndex}`;
      const next = new Map(state.localShapeOverrides);
      next.set(key, transform);
      return { localShapeOverrides: next };
    }),
  clearLocalShapeOverrides: () => set({ localShapeOverrides: new Map() }),
  toggleShapeVisibility: (slideIndex, shapeIndex) =>
    set((state) => {
      if (!state.document) return state;
      const content = state.document.content as import("@dude/presentation-editor/types").PptxContent;
      const slides = content.slides.map((slide, si) => {
        if (si !== slideIndex) return slide;
        return {
          ...slide,
          shapes: slide.shapes?.map((s) =>
            s.shapeIndex === shapeIndex ? { ...s, hidden: !s.hidden } : s,
          ),
        };
      });
      return { document: { ...state.document, content: { ...content, slides } } };
    }),

  setDocument: (doc) => set({ document: doc, error: null }),

  setContent: (content) =>
    set((state) => {
      if (!state.document) return state;
      // Push current content to undo stack (cap at 50 entries)
      const undoStack = [...state.undoStack, state.document.content].slice(-50);
      return {
        document: { ...state.document, content: assignSlideUids(content) },
        undoStack,
        redoStack: [], // clear redo on new change
      };
    }),

  setDocumentName: (name) =>
    set((state) => {
      if (!state.document) return state;
      return {
        document: { ...state.document, name },
      };
    }),

  addChange: (change) =>
    set((state) => {
      if (!state.document) return state;
      const entry: Change = {
        ...change,
        id: generateId(),
        timestamp: new Date().toISOString(),
      };
      return {
        document: {
          ...state.document,
          changes: [...state.document.changes, entry],
        },
      };
    }),

  clearChanges: () =>
    set((state) => {
      if (!state.document) return state;
      return {
        document: { ...state.document, changes: [] },
      };
    }),

  setChanges: (changes) =>
    set((state) => {
      if (!state.document) return state;
      return {
        document: { ...state.document, changes },
      };
    }),

  pendingRollback: null,
  pendingRollbackCount: 0,
  setPendingRollback: (content, changes, count) =>
    set({
      pendingRollback: { content, changes },
      pendingRollbackCount: count,
    }),
  clearPendingRollback: () =>
    set({ pendingRollback: null, pendingRollbackCount: 0 }),
  acceptPendingRollback: () =>
    set((state) => {
      if (!state.document || !state.pendingRollback) return state;
      const revision: Revision = {
        id: generateId(),
        label: `Revision ${state.revisions.length + 1}`,
        content: state.pendingRollback.content,
        changes: state.pendingRollback.changes,
        timestamp: new Date().toISOString(),
      };
      return {
        document: { ...state.document, changes: [] },
        pendingRollback: null,
        pendingRollbackCount: 0,
        revisions: [revision, ...state.revisions],
      };
    }),
  rejectPendingRollback: () =>
    set((state) => {
      if (!state.document || !state.pendingRollback) return state;
      return {
        document: {
          ...state.document,
          content: state.pendingRollback.content,
          changes: state.pendingRollback.changes,
        },
        pendingRollback: null,
        pendingRollbackCount: 0,
      };
    }),

  revisions: [],
  restoreRevision: (id) =>
    set((state) => {
      if (!state.document) return state;
      const target = state.revisions.find((r) => r.id === id);
      if (!target) return state;
      const snapshot: Revision = {
        id: generateId(),
        label: `Revision ${state.revisions.length + 1}`,
        content: state.document.content,
        changes: state.document.changes,
        timestamp: new Date().toISOString(),
      };
      return {
        document: {
          ...state.document,
          content: target.content,
          changes: target.changes,
        },
        revisions: [snapshot, ...state.revisions],
        pendingRollback: null,
        pendingRollbackCount: 0,
      };
    }),

  selectedSlideIndices: [],
  toggleSlideSelection: (index) =>
    set((state) => {
      const current = state.selectedSlideIndices;
      const exists = current.includes(index);
      return {
        selectedSlideIndices: exists
          ? current.filter((i) => i !== index)
          : [...current, index].sort((a, b) => a - b),
      };
    }),
  clearSlideSelection: () => set({ selectedSlideIndices: [] }),

  reorderSlides: (fromIndex, toIndex) =>
    set((state) => {
      if (!state.document) return state;
      const content = state.document.content as import("@dude/presentation-editor/types").PptxContent;
      const slides = [...content.slides];
      const [moved] = slides.splice(fromIndex, 1);
      slides.splice(toIndex, 0, moved);
      const reindexed = slides.map((s, i) => ({ ...s, index: i }));
      return {
        document: {
          ...state.document,
          content: { ...content, slides: reindexed },
        },
        editingSlideIndex:
          state.editingSlideIndex === fromIndex
            ? toIndex
            : state.editingSlideIndex === null
              ? null
              : state.editingSlideIndex >= Math.min(fromIndex, toIndex) &&
                  state.editingSlideIndex <= Math.max(fromIndex, toIndex)
                ? state.editingSlideIndex + (fromIndex > toIndex ? 1 : -1)
                : state.editingSlideIndex,
      };
    }),

  deleteSlides: (indices) =>
    set((state) => {
      if (!state.document) return state;
      const content = state.document.content as import("@dude/presentation-editor/types").PptxContent;
      const toDelete = new Set(indices);
      const remaining = content.slides.filter((_, i) => !toDelete.has(i));
      if (remaining.length === 0) return state; // prevent deleting all slides
      const reindexed = remaining.map((s, i) => ({ ...s, index: i }));
      return {
        document: {
          ...state.document,
          content: { ...content, slides: reindexed },
        },
        editingSlideIndex:
          state.editingSlideIndex !== null && toDelete.has(state.editingSlideIndex)
            ? null
            : state.editingSlideIndex,
        selectedSlideIndices: [],
      };
    }),

  presentationHtml: null,
  setPresentationHtml: (html) => set({ presentationHtml: html }),
  showPresentation: false,
  setShowPresentation: (show) => set({ showPresentation: show }),

  referenceText: null,
  referenceName: null,
  setReference: (name, text) => set({ referenceName: name, referenceText: text }),
  clearReference: () => set({ referenceName: null, referenceText: null }),

  // Undo / Redo
  undoStack: [],
  redoStack: [],
  pushUndo: () =>
    set((state) => {
      if (!state.document) return state;
      return { undoStack: [...state.undoStack, state.document.content].slice(-50), redoStack: [] };
    }),
  undo: () =>
    set((state) => {
      if (!state.document || state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      return {
        document: { ...state.document, content: prev },
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, state.document.content].slice(-50),
      };
    }),
  redo: () =>
    set((state) => {
      if (!state.document || state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        document: { ...state.document, content: next },
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, state.document.content].slice(-50),
      };
    }),

  loadDocument: (name, type, content, originalFile) =>
    set({
      document: {
        id: generateId(),
        name,
        type,
        originalFile,
        content: assignSlideUids(content),
        changes: [],
      },
      error: null,
      pendingRollback: null,
      pendingRollbackCount: 0,
      revisions: [],
      selectedSlideIndices: [],
      presentationHtml: null,
      showPresentation: false,
      editingSlideIndex: null,
      selectedShapeId: null,
      localShapeOverrides: new Map(),
      undoStack: [],
      redoStack: [],
    }),

  clearDocument: () =>
    set({ document: null, error: null, pendingRollback: null, pendingRollbackCount: 0, revisions: [], referenceText: null, referenceName: null, selectedSlideIndices: [], presentationHtml: null, showPresentation: false, editingSlideIndex: null, selectedShapeId: null, localShapeOverrides: new Map(), undoStack: [], redoStack: [] }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),
}));
