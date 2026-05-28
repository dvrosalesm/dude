/**
 * Main Assistant subagent.
 *
 * One instance per (orgId, userId) thread. Registers a delegation tool
 * for each subagent listed in ENABLED_SUBAGENTS (JSON array env var),
 * plus standard base tools. Cross-subagent context passing flows through
 * the tool `context` arg on each call.
 */

import type {
  PiContext,
  SubagentDeclaration,
  SubagentSetup,
  ToolDefinition,
} from "../types.js";
import { createSubagentCallTool } from "../tools/subagent-call.js";
import { createListWorkspacesTool } from "../tools/list-subagent-workspaces.js";
import { createCreateWorkspaceTool } from "../tools/create-subagent-workspace.js";
import { createListProjectWorkspacesTool } from "../tools/list-project-workspaces.js";
import { createReviewSubagentWorkTool } from "../tools/review-subagent-work.js";
import { createGenerateImageTool } from "../tools/generate-image.js";

function parseEnabledSubagents(): Array<{
  id: string;
  label?: string;
  description?: string;
}> {
  const raw = process.env.ENABLED_SUBAGENTS || "";
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

export const declaration: SubagentDeclaration = {
  baseTools: [
    "web_search",
    "web_scrape",
    "workspace_read",
    "workspace_save",
    "read_subagent_artifact",
    "save_memory",
    "list_memories",
  ],
  customTools: [() => createGenerateImageTool({ audience: "main-assistant" })],
  collections: ["gtSession"],
};

/**
 * Custom setup — we need to register one specialist-call tool per
 * enabled subagent, driven by env. Exposed separately so the registry
 * can pick it up without losing the declarative shape.
 */
export function setupMainAssistant(): SubagentSetup {
  return (pi: PiContext) => {
    // Base tools from declaration are registered by the registry wrapper.
    for (const entry of parseEnabledSubagents()) {
      const tool: ToolDefinition = createSubagentCallTool({
        subagentId: entry.id,
        label: entry.label,
        description: entry.description,
      })();
      pi.registerTool(tool);
    }
    // Workspace management tools — used before subagent delegation.
    pi.registerTool(createListWorkspacesTool());
    pi.registerTool(createCreateWorkspaceTool());
    pi.registerTool(createListProjectWorkspacesTool());
    pi.registerTool(createReviewSubagentWorkTool());
  };
}
