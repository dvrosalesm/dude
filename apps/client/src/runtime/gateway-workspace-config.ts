"use client";

import { gatewayRequest, canUseGateway } from "./gateway-desktop";

type CollectionResponse = Record<string, unknown>;

async function readInternalCollection(
  workspaceId: string,
  collection: string,
): Promise<CollectionResponse | null> {
  try {
    return await gatewayRequest<CollectionResponse>(
      `/internal/workspace/${encodeURIComponent(workspaceId)}/collection/${encodeURIComponent(collection)}`,
      { timeoutMs: 15_000 },
    );
  } catch {
    return null;
  }
}

/**
 * Merge presentation artifacts from the same SQLite row agent tools write to.
 * Client local state can lag behind internal API saves (especially in browser dev).
 */
export async function hydrateWorkspaceConfigurationsFromGateway(
  workspaceId: string,
  existing: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!canUseGateway()) return existing;

  const [documentContentRes, documentEditsRes, designDocRes] = await Promise.all([
    readInternalCollection(workspaceId, "documentContent"),
    readInternalCollection(workspaceId, "documentEdits"),
    readInternalCollection(workspaceId, "designDoc"),
  ]);

  const documentContent = documentContentRes?.documentContent;
  const documentEdits = documentEditsRes?.documentEdits;
  const designDoc = designDocRes?.designDoc;

  const hasSlides =
    documentContent &&
    typeof documentContent === "object" &&
    Array.isArray((documentContent as { slides?: unknown[] }).slides) &&
    ((documentContent as { slides: unknown[] }).slides.length > 0);

  if (!hasSlides && !documentEdits && !designDoc) {
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
    ...(documentEdits !== undefined && documentEdits !== null
      ? { documentEdits }
      : {}),
    ...(designDoc !== undefined && designDoc !== null ? { designDoc } : {}),
  };
}
