import type { SpecialistHostConfig, SpecialistPlugin } from "./types.js";
import { createSpecialistRegistry } from "./registry.js";

export type {
  BaseToolId,
  SpecialistDeclaration,
  ToolDefinition,
} from "./types.js";

export { createSpecialistRegistry } from "./registry.js";

export interface LoadedGatewaySpecialists {
  registry: ReturnType<typeof createSpecialistRegistry>;
  specialists: Record<string, import("./types.js").SpecialistDeclaration>;
}

export function loadGatewaySpecialists(config: SpecialistHostConfig): LoadedGatewaySpecialists {
  const registry = createSpecialistRegistry(config);
  const specialists: Record<string, import("./types.js").SpecialistDeclaration> = {};

  for (const plugin of registry.list()) {
    if (!plugin.gateway) continue;
    specialists[plugin.id] = plugin.gateway.declaration;
  }

  return { registry, specialists };
}

export function getGatewaySkillPaths(plugin: SpecialistPlugin): string[] {
  return plugin.gateway?.skillPaths ?? plugin.gateway?.declaration.skillPaths ?? [];
}
