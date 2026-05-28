export type BlockType =
  | "heading1"
  | "heading2"
  | "heading3"
  | "paragraph"
  | "bulletList"
  | "numberedList"
  | "code"
  | "quote"
  | "callout"
  | "divider"
  | "image"
  | "table";

export type CalloutVariant = "info" | "warning" | "success" | "error" | "tip";

export type DocumentBlock = {
  id: string;
  type: BlockType;
  content: string;
  meta?: Record<string, unknown>;
};

export type DocumentTemplate = "default" | "professional" | "minimal" | "modern" | "academic";

export type ContextDocument = {
  id: string;
  name: string;
  text: string;
  addedAt: string;
};

export type WriterDocumentContent = {
  blocks: DocumentBlock[];
  title: string;
};

export type PageLayout = {
  headerHtml: string;
  footerHtml: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  marginPreset: string;
};

export type WriterConfiguration = {
  subagent: string;
  version: number;
  workspaceId: string;
  description: string;
  template: DocumentTemplate;
  contextDocuments: ContextDocument[];
  documentContent?: WriterDocumentContent;
  pageLayout?: PageLayout;
};
