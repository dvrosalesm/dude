import type { SubagentDeclaration } from "@dude/sdk/gateway";
import { createEditDocumentTool } from "./edit-document.js";

/**
 * Document Writer subagent — structured document authoring.
 *
 * Custom tool: edit_document (real-time document editing via events).
 */
export const declaration: SubagentDeclaration = {
  baseTools: [
    "web_search",
    "web_scrape",
    "search_in_website",
    "workspace_read",
    "read_subagent_artifact",
    "save_memory",
    "list_memories",
  ],
  customTools: [
    createEditDocumentTool,
  ],
  collections: [],
};
