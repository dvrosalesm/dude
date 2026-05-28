/**
 * Main Assistant specialist.
 *
 * One instance per (orgId, userId) thread. Registers a delegation tool
 * for each specialist listed in ENABLED_SPECIALISTS (JSON array env var),
 * plus standard base tools. Cross-specialist context passing flows through
 * the tool `context` arg on each call.
 */

import type {
  PiContext,
  SpecialistDeclaration,
  SpecialistSetup,
  ToolDefinition,
} from "../types.js";
import { createSpecialistCallTool } from "../tools/specialist-call.js";
import { createListWorkspacesTool } from "../tools/list-specialist-workspaces.js";
import { createCreateWorkspaceTool } from "../tools/create-specialist-workspace.js";
import { createListProjectWorkspacesTool } from "../tools/list-project-workspaces.js";
import { createReviewSpecialistWorkTool } from "../tools/review-specialist-work.js";

function parseEnabledSpecialists(): Array<{
  id: string;
  label?: string;
  description?: string;
}> {
  const raw = process.env.ENABLED_SPECIALISTS || "";
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry): { id: string; label?: string; description?: string } | null => {
        if (typeof entry === "string") return { id: entry };
        if (entry && typeof entry === "object" && typeof entry.id === "string") {
          return {
            id: entry.id,
            label: typeof entry.label === "string" ? entry.label : undefined,
            description:
              typeof entry.description === "string"
                ? entry.description
                : undefined,
          };
        }
        return null;
      })
      .filter((e): e is { id: string; label?: string; description?: string } => e !== null);
  } catch {
    return [];
  }
}

export const declaration: SpecialistDeclaration = {
  baseTools: [
    "web_search",
    "web_scrape",
    "workspace_read",
    "workspace_save",
    "read_specialist_artifact",
    "save_memory",
    "list_memories",
  ],
  customTools: [],
  collections: ["gtSession"],
};

/**
 * Custom setup — we need to register one specialist-call tool per
 * enabled specialist, driven by env. Exposed separately so the registry
 * can pick it up without losing the declarative shape.
 */
export function setupMainAssistant(): SpecialistSetup {
  return (pi: PiContext) => {
    // Base tools from declaration are registered by the registry wrapper.
    for (const entry of parseEnabledSpecialists()) {
      const tool: ToolDefinition = createSpecialistCallTool({
        specialistId: entry.id,
        label: entry.label,
        description: entry.description,
      })();
      pi.registerTool(tool);
    }
    // Workspace management tools — used before specialist delegation.
    pi.registerTool(createListWorkspacesTool());
    pi.registerTool(createCreateWorkspaceTool());
    pi.registerTool(createListProjectWorkspacesTool());
    pi.registerTool(createReviewSpecialistWorkTool());
  };
}
