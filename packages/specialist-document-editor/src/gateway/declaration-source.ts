import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SpecialistDeclaration } from "@dude/sdk/gateway";
import { resolveGatewaySkillPaths } from "@dude/sdk/gateway-runtime";
import { createEditPresentationTool } from "./edit-presentation.js";
import { createReadSlideTool } from "./read-slide.js";
import { createGenerateSlideTool } from "./generate-slide.js";
import { createManageDesignTool } from "./manage-design.js";

const gatewayDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Document Editor specialist — presentation editing.
 *
 * Custom tools:
 * - edit_presentation: persist slide edits (agent writes HTML)
 * - read_slide: read full slide content before editing
 * - generate_slide: Pi-only — hosted LLM generates HTML (excluded for Codex/Cursor/Hermes)
 * - manage_design: read/save design.md; create/update are Pi-only hosted LLM
 */
export const declaration: SpecialistDeclaration = {
  baseTools: [
    "web_search",
    "web_scrape",
    "workspace_read",
    "read_specialist_artifact",
    "save_memory",
    "list_memories",
  ],
  customTools: [
    createEditPresentationTool,
    createReadSlideTool,
    createGenerateSlideTool,
    createManageDesignTool,
  ],
  collections: [],
  skillPaths: resolveGatewaySkillPaths(gatewayDir, [
    "baoyu-slide-deck",
    "pptx-generator",
    "presentation-design",
    "giving-presentations",
    "pitch-deck",
  ]),
};
