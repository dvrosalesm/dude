import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@dude/sdk/gateway";
import {
  config,
  internalPost,
  isApiError,
  toolError,
  toolText,
  wsPath,
} from "@dude/sdk/gateway-runtime";

export function createEditDocumentTool(): ToolDefinition {
  return {
    name: "edit_document",
    label: "Edit Document",
    description:
      "REQUIRED to change what the user sees in the document canvas. Chat text alone does not update the editor. " +
      "Apply edits to the document. Pass an array of edit actions. " +
      "Available actions:\n" +
      '- replaceAll: Replace the entire document. Params: { title, blocks: [{ type, content, meta? }] }\n' +
      '- setTitle: Change the document title. Params: { title }\n' +
      '- addBlock: Add a new block. Params: { block: { type, content, meta? }, afterBlockId? }\n' +
      '- updateBlock: Update an existing block. Params: { blockId, updates: { type?, content?, meta? } }\n' +
      '- deleteBlock: Remove a block. Params: { blockId }\n\n' +
      "Block types: heading1, heading2, heading3, paragraph, bulletList, numberedList, code, quote, callout, divider, image, table.\n" +
      "Callout blocks use meta: { variant: 'info'|'warning'|'success'|'error'|'tip' }.\n" +
      "Content supports inline HTML: <strong>, <em>, <u>, <s>, <code>, <a href=\"...\">, " +
      "<span style=\"color:#hex\"> for text colors, <mark style=\"background-color:#hex\"> for highlights.\n" +
      "You can call this tool multiple times. Batch related edits into a single call when possible.",
    parameters: Type.Object({
      edits: Type.Array(
        Type.Object(
          {
            action: Type.String({
              description:
                "Action type: replaceAll, setTitle, addBlock, updateBlock, deleteBlock",
            }),
          },
          { additionalProperties: true },
        ),
        { description: "Array of edit actions to apply in order" },
      ),
    }),
    execute: async (_id: any, params: any) => {
      const edits = params.edits;
      if (!Array.isArray(edits)) return toolError("edits must be an array");
      const valid = edits.filter(
        (e: any) => e && typeof e.action === "string",
      );
      if (!valid.length) {
        return toolError("No valid edit actions in edits array");
      }

      const saveResult = await internalPost(wsPath("collection"), {
        collection: "documentWriterEdits",
        data: { edits: valid },
      });

      if (isApiError(saveResult)) {
        console.error(`[edit_document] Failed to save edits: ${saveResult.error}`);
        return toolText({
          success: false,
          error: `Failed to persist edits: ${saveResult.error}. Please try again.`,
          editCount: valid.length,
        });
      }

      console.log(
        `[edit_document] Saved ${valid.length} edit(s) to workspace ${config.workspaceId}`,
      );

      return toolText({
        success: true,
        editCount: valid.length,
        accepted: valid.length,
        rejected: edits.length - valid.length,
      });
    },
  };
}
