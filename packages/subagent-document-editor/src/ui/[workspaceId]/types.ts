import type { DocumentContent, DocumentType, Change } from "@dude/presentation-editor/types";

export type DocumentRevision = {
  id: string;
  label: string;
  content: DocumentContent;
  changes: Change[];
  prompt: string;
  thumbnail?: string;
  createdAt: string;
};

export type DocumentWorkspace = {
  id: string;
  name: string;
  date?: string;
  configurations?: {
    specialist?: string;
    documentName?: string;
    documentType?: DocumentType;
    documentContent?: DocumentContent;
    revisions?: DocumentRevision[];
    referenceText?: string;
    referenceName?: string;
    designStyle?: string;
    fontPair?: string;
  };
};

export type EditorMode = "setup" | "editor";
