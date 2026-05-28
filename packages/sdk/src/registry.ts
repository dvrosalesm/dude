import type {
  SpecialistHostConfig,
  SpecialistPlugin,
} from "./types.js";

export function defineSpecialist(plugin: SpecialistPlugin): SpecialistPlugin {
  return plugin;
}

export function defineSpecialistHost(config: SpecialistHostConfig): SpecialistHostConfig {
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();

  for (const specialist of config.specialists) {
    if (seenIds.has(specialist.id)) {
      throw new Error(`Duplicate specialist id: ${specialist.id}`);
    }
    if (seenPaths.has(specialist.path)) {
      throw new Error(`Duplicate specialist path: ${specialist.path}`);
    }
    seenIds.add(specialist.id);
    seenPaths.add(specialist.path);
  }

  return config;
}

export function createSpecialistRegistry(config: SpecialistHostConfig) {
  const specialists = [...config.specialists];
  const byId = new Map(specialists.map((s) => [s.id, s]));
  const byPath = new Map(specialists.map((s) => [s.path, s]));

  return {
    list(): SpecialistPlugin[] {
      return specialists;
    },
    getById(id: string): SpecialistPlugin | undefined {
      return byId.get(id);
    },
    getByPath(path: string): SpecialistPlugin | undefined {
      return byPath.get(path) ?? byId.get(path);
    },
    resolveId(input: string): string | null {
      if (byId.has(input)) return input;
      return byPath.get(input)?.id ?? null;
    },
  };
}

export type SpecialistRegistry = ReturnType<typeof createSpecialistRegistry>;

export function getManageableSpecialists(registry: SpecialistRegistry) {
  return registry.list().map((s) => ({
    id: s.id,
    path: s.path,
    gatewayLabel: s.manifest.gatewayLabel,
    gatewayDescription: s.manifest.gatewayDescription,
    delegable: s.manifest.delegable,
  }));
}

export function getDelegableSpecialists(registry: SpecialistRegistry) {
  return getManageableSpecialists(registry).filter((s) => s.delegable !== false);
}

export function isManageableSpecialist(registry: SpecialistRegistry, id: string) {
  return registry.getById(id) != null;
}

export function resolveManageableSpecialistId(registry: SpecialistRegistry, input: string) {
  return registry.resolveId(input);
}

export type { ManageableSpecialist, SpecialistPlugin, SpecialistHostConfig } from "./types.js";
