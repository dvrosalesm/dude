import { httpError, HttpError } from "../../http-error.js";
import { COLLECTION_REGISTRY } from "../../../lib/collection-registry";
import { materializeDocumentWriterEdits } from "../../../lib/document-writer-materialize.js";
import { materializePresentationEdits } from "../../../lib/presentation-materialize.js";
import { getWorkspaceConfig, updateWorkspaceConfig } from "./workspace-config.js";
import { withCollectionLock } from "./collection-lock.js";

/**
 * POST /v1/internal/workspace/:workspaceId/collection
 */
export async function saveCollection(
  workspaceId: string,
  body: { collection: string; data: Record<string, unknown>; mode?: "upsert" | "delete" },
) {
  const { collection } = body;
  const mode = body.mode === "delete" ? "delete" : "upsert";
  let { data } = body as { data: unknown };
  if (!collection || !data) {
    throw httpError("collection and data are required", 400);
  }
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      throw httpError("data must be a JSON object", 400);
    }
  }

  const spec = COLLECTION_REGISTRY[collection];
  if (!spec) {
    throw httpError(
      `Unknown collection: ${collection}. Valid: ${Object.keys(COLLECTION_REGISTRY).join(", ")}`,
      400,
    );
  }

  try {
    if (spec.type === "singleton") {
      if (mode === "delete") {
        throw httpError(`Cannot delete from singleton collection: ${collection}`, 400);
      }
      const cfg = await getWorkspaceConfig(workspaceId);
      const value = { ...(data as Record<string, unknown>), updatedAt: new Date().toISOString() };
      cfg[collection] = value;
      await updateWorkspaceConfig(workspaceId, cfg);
      console.log(`[internal] collection.save: set ${collection} for ${workspaceId}`);
      return { status: "saved" };
    }

    return await withCollectionLock(workspaceId, collection, async () => {
      const cfg = await getWorkspaceConfig(workspaceId);
      let items: Record<string, unknown>[] = [];
      try {
        const raw = cfg[collection];
        items = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
      } catch {
        items = [];
      }

      if (mode === "delete") {
        const targetId = (data as Record<string, unknown>).id as string | undefined;
        if (!targetId) {
          throw httpError("data.id is required for mode=delete", 400);
        }
        const before = items.length;
        items = items.filter((item) => item.id !== targetId);
        const removed = before - items.length;
        cfg[collection] = items;
        await updateWorkspaceConfig(workspaceId, cfg);
        console.log(
          `[internal] collection.save: deleted ${collection}/${targetId} (removed=${removed}, ${items.length} total) for ${workspaceId}`,
        );
        return { status: "deleted", id: targetId, removed };
      }

      const dataRecord = data as Record<string, unknown>;
      const itemId = (dataRecord.id as string) || crypto.randomUUID();
      const existingIdx = items.findIndex((item) => item.id === itemId);
      const now = new Date().toISOString();

      const item = {
        ...(existingIdx >= 0 ? items[existingIdx] : {}),
        ...dataRecord,
        id: itemId,
        updatedAt: now,
        ...(existingIdx < 0 ? { createdAt: now } : {}),
      };

      if (existingIdx >= 0) {
        items[existingIdx] = item;
      } else {
        items.push(item);
      }

      const maxItems = spec.maxItems || 100;
      const trimmed = items.slice(-maxItems);

      cfg[collection] = trimmed;
      let nextCfg = cfg;
      if (collection === "documentEdits") {
        nextCfg = materializePresentationEdits(
          cfg,
          dataRecord as { edits?: unknown[] },
        );
      } else if (collection === "documentWriterEdits") {
        nextCfg = materializeDocumentWriterEdits(
          cfg,
          dataRecord as { edits?: unknown[] },
        );
      }
      await updateWorkspaceConfig(workspaceId, nextCfg);

      if (collection === "documentEdits") {
        console.log(
          `[internal] presentation.materialize: applied ${Array.isArray(dataRecord.edits) ? dataRecord.edits.length : 0} edit(s), cleared documentEdits queue for ${workspaceId}`,
        );
      }
      if (collection === "documentWriterEdits") {
        console.log(
          `[internal] document-writer.materialize: applied ${Array.isArray(dataRecord.edits) ? dataRecord.edits.length : 0} edit(s) for ${workspaceId}`,
        );
      }

      console.log(
        `[internal] collection.save: ${existingIdx >= 0 ? "updated" : "created"} ${collection}/${itemId} (${trimmed.length} total) for ${workspaceId}`,
      );
      return { status: "saved", id: itemId };
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const message = error instanceof Error ? error.message : "Failed to save";
    console.error(`[internal] collection.save failed (${collection}):`, message);
    throw httpError(message, 500);
  }
}

/**
 * GET /v1/internal/workspace/:workspaceId/collection/:collection
 */
export async function readCollection(workspaceId: string, collection: string) {
  try {
    const config = await getWorkspaceConfig(workspaceId);
    return { [collection]: config[collection] ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read";
    throw httpError(message, 500);
  }
}
