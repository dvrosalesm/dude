import type {
  SubagentHostConfig,
  SubagentPlugin,
} from "./types.js";

export function defineSubagent(plugin: SubagentPlugin): SubagentPlugin {
  return plugin;
}

export function defineSubagentHost(config: SubagentHostConfig): SubagentHostConfig {
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();

  for (const subagent of config.subagents) {
    if (seenIds.has(subagent.id)) {
      throw new Error(`Duplicate subagent id: ${subagent.id}`);
    }
    if (seenPaths.has(subagent.path)) {
      throw new Error(`Duplicate subagent path: ${subagent.path}`);
    }
    seenIds.add(subagent.id);
    seenPaths.add(subagent.path);
  }

  return config;
}

export function createSubagentRegistry(config: SubagentHostConfig) {
  const subagents = [...config.subagents];
  const byId = new Map(subagents.map((s) => [s.id, s]));
  const byPath = new Map(subagents.map((s) => [s.path, s]));

  return {
    list(): SubagentPlugin[] {
      return subagents;
    },
    getById(id: string): SubagentPlugin | undefined {
      return byId.get(id);
    },
    getByPath(path: string): SubagentPlugin | undefined {
      return byPath.get(path) ?? byId.get(path);
    },
    resolveId(input: string): string | null {
      if (byId.has(input)) return input;
      return byPath.get(input)?.id ?? null;
    },
  };
}

export type SubagentRegistry = ReturnType<typeof createSubagentRegistry>;

export function getManageableSubagents(registry: SubagentRegistry) {
  return registry.list().map((s) => ({
    id: s.id,
    path: s.path,
    gatewayLabel: s.manifest.gatewayLabel,
    gatewayDescription: s.manifest.gatewayDescription,
    delegable: s.manifest.delegable,
  }));
}

export function getDelegableSubagents(registry: SubagentRegistry) {
  return getManageableSubagents(registry).filter((s) => s.delegable !== false);
}

export function isManageableSubagent(registry: SubagentRegistry, id: string) {
  return registry.getById(id) != null;
}

export function resolveManageableSubagentId(registry: SubagentRegistry, input: string) {
  return registry.resolveId(input);
}

export type { ManageableSubagent, SubagentPlugin, SubagentHostConfig } from "./types.js";
