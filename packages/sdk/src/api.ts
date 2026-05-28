import { Elysia } from "elysia";
import type { SpecialistHostConfig } from "./types.js";
import { createSpecialistRegistry } from "./registry.js";

export type { SpecialistHostConfig, SpecialistPlugin } from "./types.js";
export { defineSpecialist, defineSpecialistHost } from "./registry.js";
export { loadGatewaySpecialists, getGatewaySkillPaths } from "./gateway.js";

type AnyElysia = Elysia<any, any, any, any, any, any, any>;

export function mountAllSpecialistApi(
  app: AnyElysia,
  config: SpecialistHostConfig,
  basePath = "/api/specialists",
) {
  const registry = createSpecialistRegistry(config);

  for (const plugin of registry.list()) {
    const sub = new Elysia({ prefix: `${basePath}/${plugin.path}` });
    plugin.api(sub);
    app.use(sub);
  }

  return registry;
}

export function jsonResponse(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message, message }, { status });
}

export function createApiApp(config: SpecialistHostConfig) {
  const app = new Elysia();
  const registry = mountAllSpecialistApi(app, config);
  return { app, registry };
}
