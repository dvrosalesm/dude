import type { SubagentHostConfig, SubagentPlugin } from "./types.js";
import { createSubagentRegistry } from "./registry.js";

export type {
  BaseToolId,
  SubagentDeclaration,
  ToolDefinition,
} from "./types.js";

export { createSubagentRegistry } from "./registry.js";

export interface LoadedGatewaySubagents {
  registry: ReturnType<typeof createSubagentRegistry>;
  subagents: Record<string, import("./types.js").SubagentDeclaration>;
}

export function loadGatewaySubagents(config: SubagentHostConfig): LoadedGatewaySubagents {
  const registry = createSubagentRegistry(config);
  const subagents: Record<string, import("./types.js").SubagentDeclaration> = {};

  for (const plugin of registry.list()) {
    if (!plugin.gateway) continue;
    subagents[plugin.id] = plugin.gateway.declaration;
  }

  return { registry, subagents };
}

export function getGatewaySkillPaths(plugin: SubagentPlugin): string[] {
  return plugin.gateway?.skillPaths ?? plugin.gateway?.declaration.skillPaths ?? [];
}
