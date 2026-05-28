"use client";

import { gatewayRequest, canUseGateway } from "./gateway-desktop";
import { mergeGatewayConfigurationsFromInternal } from "./gateway-workspace-config-merge";

export { mergeGatewayConfigurationsFromInternal } from "./gateway-workspace-config-merge";

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

  return mergeGatewayConfigurationsFromInternal(existing, {
    documentContent: documentContentRes?.documentContent,
    documentEdits: documentEditsRes?.documentEdits,
    designDoc: designDocRes?.designDoc,
  });
}
