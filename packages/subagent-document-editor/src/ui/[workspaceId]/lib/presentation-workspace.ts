import { ensurePresentationHtmlSlideControls } from "@dude/presentation-editor/lib/html-slide-controls";
import { ensureRenderableSlides } from "@dude/presentation-editor/lib/ensure-renderable-slides";
import type { DocumentContent, DocumentType, PptxContent } from "@dude/presentation-editor/types";
import type { DocumentRevision } from "../types";

export function generateRevisionId(): string {
  return `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function stripForSave(content: DocumentContent): DocumentContent {
  const pptx = content as Record<string, unknown>;
  const result = { ...pptx };
  delete result.textContent;
  delete result.fullHtml;
  delete result.currentBase64;
  delete result.originalBase64;
  return result as DocumentContent;
}

export const MAX_REVISIONS = 4;

export function stripRevisionsForStorage(
  revisions: DocumentRevision[],
): Omit<DocumentRevision, "content">[] {
  return revisions.slice(0, MAX_REVISIONS).map((revision) => {
    const rest = { ...revision };
    delete (rest as { content?: DocumentRevision["content"] }).content;
    return rest;
  });
}

export function trimRevisions(revisions: DocumentRevision[]): DocumentRevision[] {
  return revisions.length > MAX_REVISIONS ? revisions.slice(0, MAX_REVISIONS) : revisions;
}

export function normalizeHtmlShaderContent(content: DocumentContent): DocumentContent {
  const pptx = content as PptxContent;
  if (!Array.isArray(pptx?.slides)) return content;
  const normalized = ensureRenderableSlides(pptx);
  return ensurePresentationHtmlSlideControls(normalized).content;
}

export function documentContentFromConfig(cfg: Record<string, unknown>): DocumentContent | null {
  const raw = cfg.documentContent as DocumentContent | undefined;
  if (!raw) return null;
  return normalizeHtmlShaderContent(raw);
}

export function loadDocumentFromConfig(
  cfg: Record<string, unknown>,
  loadDocument: (name: string, type: DocumentType, content: DocumentContent) => void,
): boolean {
  const content = documentContentFromConfig(cfg);
  if (!content) return false;
  loadDocument(
    (cfg.documentName as string) || "Presentation",
    (cfg.documentType as DocumentType) || "pptx",
    content,
  );
  return true;
}

export function restoreRevisionsFromConfig(
  config: Record<string, unknown>,
): DocumentRevision[] {
  const revisions = config.revisions;
  if (!Array.isArray(revisions) || revisions.length === 0) {
    return [];
  }

  return trimRevisions(
    revisions.map((rev: DocumentRevision, idx: number) => ({
      ...rev,
      content:
        idx === 0 ? documentContentFromConfig(config) : rev.content ?? null,
      changes: rev.changes ?? [],
    })),
  );
}

export function shouldUseSetupMode(config: Record<string, unknown>): boolean {
  const missingDocMeta = !config.hasDocument || !config.documentType;
  if (!missingDocMeta) return false;
  return !documentContentFromConfig(config);
}

export function applyPresentationConfig(
  config: Record<string, unknown>,
  actions: {
    loadDocument: (name: string, type: DocumentType, content: DocumentContent) => void;
    setReference: (name: string, text: string) => void;
    setMode: (mode: "setup" | "editor") => void;
    updateRevisions: (revisions: DocumentRevision[]) => void;
    setDocMeta: (meta: { name: string; type: DocumentType }) => void;
  },
): void {
  if (shouldUseSetupMode(config)) {
    const referenceText = config.referenceText;
    if (typeof referenceText === "string" && referenceText.length > 0) {
      actions.setReference(
        (config.referenceName as string) || "Reference",
        referenceText,
      );
    }
    actions.setMode("setup");
    return;
  }

  actions.setMode("editor");

  const referenceText = config.referenceText;
  if (typeof referenceText === "string" && referenceText.length > 0) {
    actions.setReference(
      (config.referenceName as string) || "Reference",
      referenceText,
    );
  }

  if (!loadDocumentFromConfig(config, actions.loadDocument)) {
    return;
  }

  actions.setDocMeta({
    name: (config.documentName as string) || "Document",
    type: (config.documentType as DocumentType) || "pptx",
  });
  actions.updateRevisions(restoreRevisionsFromConfig(config));
}
