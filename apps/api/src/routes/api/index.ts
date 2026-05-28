import { Elysia } from "elysia";
import type { SubagentHostConfig } from "@dude/sdk/api";
import { createSubagentRegistry } from "@dude/sdk";

export function createApiRoutes(hostConfig: SubagentHostConfig) {
  const app = new Elysia();
  const registry = createSubagentRegistry(hostConfig);

  app.get("/api/health", () => ({ status: "ok", service: "dude-server" }));

  app.get("/api", () => ({
    name: "dude-server",
    subagents: registry.list().map((s) => ({ id: s.id, path: s.path })),
  }));

  return { app, registry };
}
