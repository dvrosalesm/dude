import { applyDocumentEdits } from "@dude/specialist-document-writer/lib/apply-document-edits";
import type { WriterDocumentContent } from "@dude/specialist-document-writer/types";

type EditBatch = { edits?: unknown[] };

/**
 * Fold one edit_document batch into documentContent and clear the queue.
 */
export function materializeDocumentWriterEdits(
  config: Record<string, unknown>,
  newBatch: EditBatch,
): Record<string, unknown> {
  const edits = Array.isArray(newBatch.edits) ? newBatch.edits : [];
  if (edits.length === 0) {
    return { ...config, documentWriterEdits: [] };
  }

  const current = config.documentContent as WriterDocumentContent | undefined;
  const merged = applyDocumentEdits(current, edits);

  return {
    ...config,
    documentContent: merged,
    documentWriterEdits: [],
  };
}
