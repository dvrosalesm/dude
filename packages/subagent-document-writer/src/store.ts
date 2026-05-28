import { create } from "zustand";
import type {
  DocumentBlock,
  DocumentTemplate,
  ContextDocument,
  WriterDocumentContent,
  PageLayout,
} from "@dude/subagent-document-writer/types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_PAGE_LAYOUT: PageLayout = {
  headerHtml: "",
  footerHtml: "",
  marginTop: "1",
  marginRight: "1",
  marginBottom: "1",
  marginLeft: "1",
  marginPreset: "normal",
};

interface DocumentWriterStore {
  // Document content
  blocks: DocumentBlock[];
  title: string;

  // Configuration
  description: string;
  template: DocumentTemplate;
  contextDocuments: ContextDocument[];

  // Page layout
  pageLayout: PageLayout;

  // UI state
  activeTab: "configure" | "editor" | "layout";

  // Actions — content
  setBlocks: (blocks: DocumentBlock[]) => void;
  setTitle: (title: string) => void;
  addBlock: (block: Omit<DocumentBlock, "id">, afterId?: string) => void;
  updateBlock: (id: string, updates: Partial<Omit<DocumentBlock, "id">>) => void;
  removeBlock: (id: string) => void;
  moveBlock: (id: string, direction: "up" | "down") => void;
  loadContent: (content: WriterDocumentContent) => void;
  getContent: () => WriterDocumentContent;

  // Actions — configuration
  setDescription: (description: string) => void;
  setTemplate: (template: DocumentTemplate) => void;
  addContextDocument: (doc: Omit<ContextDocument, "id" | "addedAt">) => void;
  removeContextDocument: (id: string) => void;

  // Actions — page layout
  setPageLayout: (layout: Partial<PageLayout>) => void;

  // Actions — UI
  setActiveTab: (tab: "configure" | "editor" | "layout") => void;

  // Reset
  reset: () => void;
}

const initialState = {
  blocks: [] as DocumentBlock[],
  title: "",
  description: "",
  template: "default" as DocumentTemplate,
  contextDocuments: [] as ContextDocument[],
  pageLayout: { ...DEFAULT_PAGE_LAYOUT },
  activeTab: "configure" as const,
};

export const useDocumentWriterStore = create<DocumentWriterStore>((set, get) => ({
  ...initialState,

  setBlocks: (blocks) => set({ blocks }),
  setTitle: (title) => set({ title }),

  addBlock: (block, afterId) =>
    set((state) => {
      const newBlock: DocumentBlock = { ...block, id: generateId() };
      if (!afterId) {
        return { blocks: [...state.blocks, newBlock] };
      }
      const idx = state.blocks.findIndex((b) => b.id === afterId);
      if (idx === -1) {
        return { blocks: [...state.blocks, newBlock] };
      }
      const next = [...state.blocks];
      next.splice(idx + 1, 0, newBlock);
      return { blocks: next };
    }),

  updateBlock: (id, updates) =>
    set((state) => ({
      blocks: state.blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),

  removeBlock: (id) =>
    set((state) => ({
      blocks: state.blocks.filter((b) => b.id !== id),
    })),

  moveBlock: (id, direction) =>
    set((state) => {
      const idx = state.blocks.findIndex((b) => b.id === id);
      if (idx === -1) return state;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= state.blocks.length) return state;
      const next = [...state.blocks];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return { blocks: next };
    }),

  loadContent: (content) =>
    set({ blocks: content.blocks, title: content.title }),

  getContent: () => ({ blocks: get().blocks, title: get().title }),

  setDescription: (description) => set({ description }),
  setTemplate: (template) => set({ template }),

  addContextDocument: (doc) =>
    set((state) => ({
      contextDocuments: [
        ...state.contextDocuments,
        { ...doc, id: generateId(), addedAt: new Date().toISOString() },
      ],
    })),

  removeContextDocument: (id) =>
    set((state) => ({
      contextDocuments: state.contextDocuments.filter((d) => d.id !== id),
    })),

  setPageLayout: (layout) =>
    set((state) => ({
      pageLayout: { ...state.pageLayout, ...layout },
    })),

  setActiveTab: (tab) => set({ activeTab: tab }),

  reset: () => set({ ...initialState, pageLayout: { ...DEFAULT_PAGE_LAYOUT } }),
}));
