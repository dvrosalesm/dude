import type { SpecialistDeclaration } from "@dude/sdk/gateway";
import { createEditDocumentTool } from "./edit-document.js";

/**
 * Document Writer specialist — structured document authoring.
 *
 * Custom tool: edit_document (real-time document editing via events).
 */
export const declaration: SpecialistDeclaration = {
  baseTools: [
    "web_search",
    "web_scrape",
    "search_in_website",
    "workspace_read",
    "read_specialist_artifact",
    "save_memory",
    "list_memories",
  ],
  customTools: [
    createEditDocumentTool,
  ],
  collections: [],
};
