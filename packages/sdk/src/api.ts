import { Elysia } from "elysia";
import type { SubagentHostConfig } from "./types.js";
import { createSubagentRegistry } from "./registry.js";

export type { SubagentHostConfig, SubagentPlugin } from "./types.js";
export { defineSubagent, defineSubagentHost } from "./registry.js";
export { loadGatewaySubagents, getGatewaySkillPaths } from "./gateway.js";

type AnyElysia = Elysia<any, any, any, any, any, any, any>;

export function mountAllSubagentApi(
  app: AnyElysia,
  config: SubagentHostConfig,
  basePath = "/api/subagents",
) {
  const registry = createSubagentRegistry(config);

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

export function createApiApp(config: SubagentHostConfig) {
  const app = new Elysia();
  const registry = mountAllSubagentApi(app, config);
  return { app, registry };
}
