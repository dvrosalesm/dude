function isPresentationDocumentContent(
  value: unknown,
): value is { slides: unknown[] } {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    Array.isArray((value as { slides?: unknown[] }).slides) &&
    ((value as { slides: unknown[] }).slides.length > 0)
  );
}

function isDocumentWriterContent(
  value: unknown,
): value is { blocks: unknown[]; title?: string } {
  if (!value || typeof value !== "object") return false;
  const blocks = (value as { blocks?: unknown[] }).blocks;
  const title = (value as { title?: unknown }).title;
  return (
    (Array.isArray(blocks) && blocks.length > 0) ||
    (typeof title === "string" && title.trim().length > 0)
  );
}

/**
 * Merge subagent artifacts from the SQLite row agent tools write to.
 * Client local state can lag behind internal API saves (especially in browser dev).
 */
export function mergeGatewayConfigurationsFromInternal(
  existing: Record<string, unknown>,
  internal: {
    documentContent?: unknown;
    documentEdits?: unknown;
    designDoc?: unknown;
  },
): Record<string, unknown> {
  const { documentContent, documentEdits, designDoc } = internal;
  const hasSlides = isPresentationDocumentContent(documentContent);
  const hasWriterDoc = isDocumentWriterContent(documentContent);

  if (!hasSlides && !hasWriterDoc && !documentEdits && !designDoc) {
    return existing;
  }

  return {
    ...existing,
    ...(hasSlides
      ? {
          documentContent,
          hasDocument: true,
          documentType:
            (existing.documentType as string | undefined) ?? "pptx",
          documentName:
            (existing.documentName as string | undefined) ?? "Presentation",
        }
      : {}),
    ...(hasWriterDoc
      ? {
          documentContent,
        }
      : {}),
    ...(documentEdits !== undefined && documentEdits !== null
      ? { documentEdits }
      : {}),
    ...(designDoc !== undefined && designDoc !== null ? { designDoc } : {}),
  };
}
