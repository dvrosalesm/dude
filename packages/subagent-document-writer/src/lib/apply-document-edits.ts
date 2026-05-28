import type { DocumentBlock, WriterDocumentContent } from "../types/document-writer.js";

export function generateDocumentBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function applyDocumentEdits(
  current: WriterDocumentContent | null | undefined,
  edits: unknown[],
): WriterDocumentContent {
  let blocks = [...(current?.blocks ?? [])];
  let title = current?.title ?? "";

  for (const rawEdit of edits) {
    if (!rawEdit || typeof rawEdit !== "object") continue;
    const edit = rawEdit as Record<string, unknown>;
    const action = typeof edit.action === "string" ? edit.action : "";
    switch (action) {
      case "replaceAll": {
        title = typeof edit.title === "string" ? edit.title : title;
        blocks = (Array.isArray(edit.blocks) ? edit.blocks : []).map((b: unknown) => {
          const block = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
          return {
            id: generateDocumentBlockId(),
            type: (typeof block.type === "string" ? block.type : "paragraph") as DocumentBlock["type"],
            content: typeof block.content === "string" ? block.content : "",
            meta: block.meta as DocumentBlock["meta"],
          };
        });
        break;
      }
      case "setTitle": {
        if (typeof edit.title === "string") title = edit.title;
        break;
      }
      case "addBlock": {
        const blockSource =
          edit.block && typeof edit.block === "object"
            ? (edit.block as Record<string, unknown>)
            : {};
        const newBlock: DocumentBlock = {
          id: generateDocumentBlockId(),
          type:
            typeof blockSource.type === "string"
              ? (blockSource.type as DocumentBlock["type"])
              : "paragraph",
          content: typeof blockSource.content === "string" ? blockSource.content : "",
          meta: blockSource.meta as DocumentBlock["meta"],
        };
        const afterBlockId =
          typeof edit.afterBlockId === "string" ? edit.afterBlockId : undefined;
        if (!afterBlockId) {
          blocks = [newBlock, ...blocks];
        } else {
          const idx = blocks.findIndex((b) => b.id === afterBlockId);
          if (idx === -1) {
            blocks = [...blocks, newBlock];
          } else {
            blocks = [
              ...blocks.slice(0, idx + 1),
              newBlock,
              ...blocks.slice(idx + 1),
            ];
          }
        }
        break;
      }
      case "updateBlock": {
        const blockId = typeof edit.blockId === "string" ? edit.blockId : "";
        const updates =
          edit.updates && typeof edit.updates === "object"
            ? (edit.updates as Record<string, unknown>)
            : {};
        blocks = blocks.map((b) => {
          if (b.id !== blockId) return b;
          const next: DocumentBlock = { ...b };
          if (typeof updates.type === "string") {
            next.type = updates.type as DocumentBlock["type"];
          }
          if (typeof updates.content === "string") {
            next.content = updates.content;
          }
          if (updates.meta && typeof updates.meta === "object") {
            next.meta = updates.meta as Record<string, unknown>;
          }
          return next;
        });
        break;
      }
      case "deleteBlock": {
        const blockId = typeof edit.blockId === "string" ? edit.blockId : "";
        blocks = blocks.filter((b) => b.id !== blockId);
        break;
      }
    }
  }

  return { blocks, title };
}
