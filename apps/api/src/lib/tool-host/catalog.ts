import type {
  AgentToolCatalogEntry,
  AgentToolHostCatalogResponse,
} from "@dude/sdk/runner";
import type { ToolDefinition } from "./types.js";
import { buildToolsForSpecialist, getSpecialistMeta } from "./registry.js";
import {
  type ToolHostSession,
  withToolHostSession,
} from "./session.js";

function toolToCatalogEntry(tool: ToolDefinition): AgentToolCatalogEntry {
  return {
    name: tool.name,
    label: tool.label,
    description: tool.description,
    parameters: tool.parameters as Record<string, unknown>,
  };
}

export async function buildToolHostCatalog(
  session: ToolHostSession,
  envExtras?: Record<string, string | undefined>,
): Promise<AgentToolHostCatalogResponse> {
  return withToolHostSession(session, envExtras, async () => {
    const meta = getSpecialistMeta(session.specialistId);
    const tools = buildToolsForSpecialist(meta.specialistId, {
      runner: session.runner,
    }).map(toolToCatalogEntry);

    return {
      session: {
        workspaceId: session.workspaceId,
        specialistId: meta.specialistId,
        organizationId: session.organizationId,
        runner: session.runner,
      },
      tools,
      collections: meta.collections,
      skillPaths: meta.skillPaths,
    };
  });
}
