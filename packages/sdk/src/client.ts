import type { SpecialistRegistry } from "./registry.js";
import type { ClientRouteDescriptor, HomeGridDef, SpecialistMeta } from "./types.js";

export function getSpecialistMeta(registry: SpecialistRegistry): Record<string, SpecialistMeta> {
  const meta: Record<string, SpecialistMeta> = {};

  for (const plugin of registry.list()) {
    meta[plugin.id] = {
      icon: plugin.ui.icon,
      label: plugin.manifest.gatewayLabel,
      path: plugin.path,
    };
  }

  return meta;
}

export function getHomeGridDefs(registry: SpecialistRegistry): HomeGridDef[] {
  return registry.list().map((plugin) => ({
    id: plugin.id,
    path: plugin.path,
    title: plugin.manifest.gatewayLabel,
    description: plugin.manifest.gatewayDescription,
    badges: plugin.manifest.badges ?? [],
  }));
}

export function getClientRoutes(registry: SpecialistRegistry): ClientRouteDescriptor[] {
  const routes: ClientRouteDescriptor[] = [];

  for (const plugin of registry.list()) {
    routes.push({
      path: `/chat/specialists/${plugin.path}`,
      specialistId: plugin.id,
      kind: "list",
      component: plugin.ui.ListPage,
    });
    routes.push({
      path: `/chat/specialists/${plugin.path}/:workspaceId`,
      specialistId: plugin.id,
      kind: "workspace",
      component: plugin.ui.WorkspacePage,
    });

    if (plugin.ui.nestedRoutes) {
      for (const [nestedKey, component] of Object.entries(plugin.ui.nestedRoutes)) {
        routes.push({
          path: `/chat/specialists/${plugin.path}/:workspaceId/${nestedKey}`,
          specialistId: plugin.id,
          kind: "nested",
          nestedKey,
          component,
        });
      }
    }
  }

  return routes;
}

export function getSpecialistSummaries(registry: SpecialistRegistry) {
  return registry
    .list()
    .map((plugin) => plugin.local?.summary)
    .filter(Boolean);
}

export type { ClientRouteDescriptor, HomeGridDef, SpecialistMeta };
