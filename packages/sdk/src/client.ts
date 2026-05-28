import type { SubagentRegistry } from "./registry.js";
import type { ClientRouteDescriptor, HomeGridDef, SubagentMeta } from "./types.js";

export function getSubagentMeta(registry: SubagentRegistry): Record<string, SubagentMeta> {
  const meta: Record<string, SubagentMeta> = {};

  for (const plugin of registry.list()) {
    meta[plugin.id] = {
      icon: plugin.ui.icon,
      label: plugin.manifest.gatewayLabel,
      path: plugin.path,
    };
  }

  return meta;
}

export function getHomeGridDefs(registry: SubagentRegistry): HomeGridDef[] {
  return registry.list().map((plugin) => ({
    id: plugin.id,
    path: plugin.path,
    title: plugin.manifest.gatewayLabel,
    description: plugin.manifest.gatewayDescription,
    badges: plugin.manifest.badges ?? [],
  }));
}

export function getClientRoutes(registry: SubagentRegistry): ClientRouteDescriptor[] {
  const routes: ClientRouteDescriptor[] = [];

  for (const plugin of registry.list()) {
    routes.push({
      path: `/chat/subagents/${plugin.path}`,
      subagentId: plugin.id,
      kind: "list",
      component: plugin.ui.ListPage,
    });
    routes.push({
      path: `/chat/subagents/${plugin.path}/:workspaceId`,
      subagentId: plugin.id,
      kind: "workspace",
      component: plugin.ui.WorkspacePage,
    });

    if (plugin.ui.nestedRoutes) {
      for (const [nestedKey, component] of Object.entries(plugin.ui.nestedRoutes)) {
        routes.push({
          path: `/chat/subagents/${plugin.path}/:workspaceId/${nestedKey}`,
          subagentId: plugin.id,
          kind: "nested",
          nestedKey,
          component,
        });
      }
    }
  }

  return routes;
}

export function getSubagentSummaries(registry: SubagentRegistry) {
  return registry
    .list()
    .map((plugin) => plugin.local?.summary)
    .filter(Boolean);
}

export type { ClientRouteDescriptor, HomeGridDef, SubagentMeta };
