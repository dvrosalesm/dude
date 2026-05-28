/**
 * Central tool registry — single source of truth for specialist tools.
 * Used by Pi (in-process registration) and the Tool Host / Agent Dispatch HTTP API.
 *
 * Custom actions are declared by each specialist package in gateway/declaration-source.ts.
 */

import type {
  BaseToolId,
  SpecialistDeclaration,
  SpecialistSetup,
  ToolDefinition,
} from "./types.js";
import { createWebSearchTool } from "./tools/web-search.js";
import { createWebScrapeTool } from "./tools/web-scrape.js";
import { createSearchInWebsiteTool } from "./tools/search-in-website.js";
import { createExaSearchTool } from "./tools/exa-search.js";
import { createWorkspaceReadTool } from "./tools/workspace-read.js";
import { createWorkspaceSaveTool } from "./tools/workspace-save.js";
import { createReadSpecialistArtifactTool } from "./tools/read-specialist-artifact.js";
import { createSaveMemoryTool, createListMemoriesTool } from "./tools/memories.js";
import { createUiRequestInputTool } from "./tools/ui-request-input.js";
import { createSendProgressTool } from "./tools/send-progress.js";
import { createFinishTurnTool } from "./tools/finish-turn.js";
import {
  declaration as mainAssistant,
  setupMainAssistant,
} from "./builtin-specialists/main-assistant.js";
import { loadGatewaySpecialists } from "@dude/sdk/gateway";
import { getSpecialistHostConfig } from "../specialist-host-config.js";
import { resolveGatewaySpecialistId } from "./resolve-specialist-id.js";
import { filterToolsForRunner } from "./runner-tool-filter.js";

const BASE_TOOL_FACTORIES: Record<BaseToolId, () => ToolDefinition> = {
  web_search: createWebSearchTool,
  web_scrape: createWebScrapeTool,
  search_in_website: createSearchInWebsiteTool,
  exa_search: createExaSearchTool,
  workspace_read: createWorkspaceReadTool,
  workspace_save: createWorkspaceSaveTool,
  read_specialist_artifact: createReadSpecialistArtifactTool,
  save_memory: createSaveMemoryTool,
  list_memories: createListMemoriesTool,
};

let specialists: Record<string, SpecialistDeclaration> | null = null;

function ensureSpecialistsLoaded(): Record<string, SpecialistDeclaration> {
  if (specialists) return specialists;

  const hostConfig = getSpecialistHostConfig();
  const { specialists: pluginDeclarations } = loadGatewaySpecialists(hostConfig);

  specialists = {
    ...pluginDeclarations,
    "main-assistant": mainAssistant,
  };
  return specialists;
}

const EXTRA_SETUPS: Record<string, () => SpecialistSetup> = {
  "main-assistant": setupMainAssistant,
};

const DEFAULT_SPECIALIST = "data-analyst";

function dedupeToolsByName(tools: ToolDefinition[]): ToolDefinition[] {
  const seen = new Set<string>();
  const unique: ToolDefinition[] = [];

  for (const tool of tools) {
    if (seen.has(tool.name)) {
      console.warn(
        `[tool-host] Skipping duplicate tool "${tool.name}" in specialist setup`,
      );
      continue;
    }
    seen.add(tool.name);
    unique.push(tool);
  }

  return unique;
}

export function resolveSpecialistDeclaration(
  specialistId: string,
): SpecialistDeclaration {
  const id = resolveGatewaySpecialistId(specialistId || DEFAULT_SPECIALIST);
  const decl = ensureSpecialistsLoaded()[id];
  if (!decl) {
    console.warn(
      `[tool-host] Unknown specialist "${id}", falling back to "${DEFAULT_SPECIALIST}"`,
    );
    return ensureSpecialistsLoaded()[DEFAULT_SPECIALIST];
  }
  return decl;
}

/** Instantiate all ToolDefinition objects for a specialist (including dynamic main-assistant tools). */
export function buildToolsForSpecialist(
  specialistId: string,
  options?: { runner?: string | null },
): ToolDefinition[] {
  const id = resolveGatewaySpecialistId(specialistId || DEFAULT_SPECIALIST);
  const decl = resolveSpecialistDeclaration(id);
  const tools: ToolDefinition[] = [];

  for (const toolId of decl.baseTools) {
    const factory = BASE_TOOL_FACTORIES[toolId];
    if (factory) tools.push(factory());
  }

  for (const factory of decl.customTools) {
    tools.push(factory());
  }

  const extra = EXTRA_SETUPS[id]?.();
  if (extra) {
    const collected: ToolDefinition[] = [];
    extra({
      registerTool(tool) {
        collected.push(tool);
      },
    });
    tools.push(...collected);
  }

  // Available to every specialist while running inside Dude UI.
  tools.push(createUiRequestInputTool());
  tools.push(createSendProgressTool());
  tools.push(createFinishTurnTool());

  return filterToolsForRunner(dedupeToolsByName(tools), options?.runner);
}

export function getSpecialistMeta(specialistId: string) {
  const id = resolveGatewaySpecialistId(specialistId || DEFAULT_SPECIALIST);
  const decl = resolveSpecialistDeclaration(id);
  const loaded = ensureSpecialistsLoaded();
  return {
    specialistId: id in loaded ? id : DEFAULT_SPECIALIST,
    collections: decl.collections,
    skillPaths: decl.skillPaths ?? [],
  };
}

/** Pi gateway setup — registers tools from the central registry. */
export function buildSpecialistSetup(specialistId: string): SpecialistSetup {
  return (pi) => {
    for (const tool of buildToolsForSpecialist(specialistId)) {
      pi.registerTool(tool);
    }
  };
}

export function getSpecialistForGateway(specialistId: string) {
  const meta = getSpecialistMeta(specialistId);
  return {
    name: meta.specialistId,
    setup: buildSpecialistSetup(meta.specialistId),
    collections: meta.collections,
    skillPaths: meta.skillPaths,
  };
}
