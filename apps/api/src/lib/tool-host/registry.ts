/**
 * Central tool registry — single source of truth for subagent tools.
 * Used by Pi (in-process registration) and the Tool Host / Agent Dispatch HTTP API.
 *
 * Custom actions are declared by each subagent package in gateway/declaration-source.ts.
 */

import type {
  BaseToolId,
  SubagentDeclaration,
  SubagentSetup,
  ToolDefinition,
} from "./types.js";
import { createWebSearchTool } from "./tools/web-search.js";
import { createWebScrapeTool } from "./tools/web-scrape.js";
import { createSearchInWebsiteTool } from "./tools/search-in-website.js";
import { createExaSearchTool } from "./tools/exa-search.js";
import { createWorkspaceReadTool } from "./tools/workspace-read.js";
import { createWorkspaceSaveTool } from "./tools/workspace-save.js";
import { createReadSubagentArtifactTool } from "./tools/read-subagent-artifact.js";
import { createSaveMemoryTool, createListMemoriesTool } from "./tools/memories.js";
import { createUiRequestInputTool } from "./tools/ui-request-input.js";
import { createSendProgressTool } from "./tools/send-progress.js";
import { createFinishTurnTool } from "./tools/finish-turn.js";
import {
  declaration as mainAssistant,
  setupMainAssistant,
} from "./builtin-subagents/main-assistant.js";
import { loadGatewaySubagents } from "@dude/sdk/gateway";
import { getSubagentHostConfig } from "../subagent-host-config.js";
import { resolveGatewaySubagentId } from "./resolve-subagent-id.js";
import { filterToolsForRunner } from "./runner-tool-filter.js";

const BASE_TOOL_FACTORIES: Record<BaseToolId, () => ToolDefinition> = {
  web_search: createWebSearchTool,
  web_scrape: createWebScrapeTool,
  search_in_website: createSearchInWebsiteTool,
  exa_search: createExaSearchTool,
  workspace_read: createWorkspaceReadTool,
  workspace_save: createWorkspaceSaveTool,
  read_subagent_artifact: createReadSubagentArtifactTool,
  save_memory: createSaveMemoryTool,
  list_memories: createListMemoriesTool,
};

let subagents: Record<string, SubagentDeclaration> | null = null;

function ensureSubagentsLoaded(): Record<string, SubagentDeclaration> {
  if (subagents) return subagents;

  const hostConfig = getSubagentHostConfig();
  const { subagents: pluginDeclarations } = loadGatewaySubagents(hostConfig);

  subagents = {
    ...pluginDeclarations,
    "main-assistant": mainAssistant,
  };
  return subagents;
}

const EXTRA_SETUPS: Record<string, () => SubagentSetup> = {
  "main-assistant": setupMainAssistant,
};

const DEFAULT_SUBAGENT = "data-analyst";

function dedupeToolsByName(tools: ToolDefinition[]): ToolDefinition[] {
  const seen = new Set<string>();
  const unique: ToolDefinition[] = [];

  for (const tool of tools) {
    if (seen.has(tool.name)) {
      console.warn(
        `[tool-host] Skipping duplicate tool "${tool.name}" in subagent setup`,
      );
      continue;
    }
    seen.add(tool.name);
    unique.push(tool);
  }

  return unique;
}

export function resolveSubagentDeclaration(
  subagentId: string,
): SubagentDeclaration {
  const id = resolveGatewaySubagentId(subagentId || DEFAULT_SUBAGENT);
  const decl = ensureSubagentsLoaded()[id];
  if (!decl) {
    console.warn(
      `[tool-host] Unknown subagent "${id}", falling back to "${DEFAULT_SUBAGENT}"`,
    );
    return ensureSubagentsLoaded()[DEFAULT_SUBAGENT];
  }
  return decl;
}

/** Instantiate all ToolDefinition objects for a subagent (including dynamic main-assistant tools). */
export function buildToolsForSubagent(
  subagentId: string,
  options?: { runner?: string | null },
): ToolDefinition[] {
  const id = resolveGatewaySubagentId(subagentId || DEFAULT_SUBAGENT);
  const decl = resolveSubagentDeclaration(id);
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

  // Available to every subagent while running inside Dude UI.
  tools.push(createUiRequestInputTool());
  tools.push(createSendProgressTool());
  tools.push(createFinishTurnTool());

  return filterToolsForRunner(dedupeToolsByName(tools), options?.runner);
}

export function getSubagentMeta(subagentId: string) {
  const id = resolveGatewaySubagentId(subagentId || DEFAULT_SUBAGENT);
  const decl = resolveSubagentDeclaration(id);
  const loaded = ensureSubagentsLoaded();
  return {
    subagentId: id in loaded ? id : DEFAULT_SUBAGENT,
    collections: decl.collections,
    skillPaths: decl.skillPaths ?? [],
  };
}

/** Pi gateway setup — registers tools from the central registry. */
export function buildSubagentSetup(subagentId: string): SubagentSetup {
  return (pi) => {
    for (const tool of buildToolsForSubagent(subagentId)) {
      pi.registerTool(tool);
    }
  };
}

export function getSubagentForGateway(subagentId: string) {
  const meta = getSubagentMeta(subagentId);
  return {
    name: meta.subagentId,
    setup: buildSubagentSetup(meta.subagentId),
    collections: meta.collections,
    skillPaths: meta.skillPaths,
  };
}
