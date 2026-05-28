import { applyPendingEdits } from "@dude/presentation-editor/document-editor/apply-edits";
import { ensureRenderableSlides } from "@dude/presentation-editor/lib/ensure-renderable-slides";

type EditBatch = { edits?: unknown[] };

/**
 * Fold one edit_presentation batch into documentContent and clear the queue.
 * Edits are applied incrementally — never replay the full documentEdits history
 * (that caused duplicate slides / accidental deletes when content was already materialized).
 */
export function materializePresentationEdits(
  config: Record<string, unknown>,
  newBatch: EditBatch,
): Record<string, unknown> {
  const edits = Array.isArray(newBatch.edits) ? newBatch.edits : [];
  if (edits.length === 0) {
    return { ...config, documentEdits: [] };
  }

  if (Array.isArray(config.documentEdits) && config.documentEdits.length > 0) {
    console.warn(
      "[presentation.materialize] clearing stale documentEdits queue before incremental apply",
    );
  }

  const merged = ensureRenderableSlides(
    applyPendingEdits(
      (config.documentContent as Parameters<typeof applyPendingEdits>[0]) ?? null,
      [{ edits }],
    ) as Parameters<typeof ensureRenderableSlides>[0],
  );

  return {
    ...config,
    documentContent: merged,
    documentEdits: [],
    hasDocument: true,
    documentType: config.documentType ?? "pptx",
    documentName: config.documentName ?? "Presentation",
  };
}
