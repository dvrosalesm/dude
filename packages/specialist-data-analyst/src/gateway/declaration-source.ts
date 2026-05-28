import type { SpecialistDeclaration } from "@dude/sdk/gateway";
import { createSqlTool } from "./sql.js";
import { createPythonTool } from "./python.js";
import { createSaveDatabaseTool } from "./save-database.js";

/**
 * Data Analyst specialist.
 *
 * Uses SQLite for data storage (not workspace config).
 * Custom tools: sql, python, save_database.
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
    createSqlTool,
    createPythonTool,
    createSaveDatabaseTool,
  ],
  collections: [],
};
