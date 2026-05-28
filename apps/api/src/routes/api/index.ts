import { Elysia } from "elysia";
import type { SpecialistHostConfig } from "@dude/sdk/api";
import { createSpecialistRegistry } from "@dude/sdk";

export function createApiRoutes(hostConfig: SpecialistHostConfig) {
  const app = new Elysia();
  const registry = createSpecialistRegistry(hostConfig);

  app.get("/api/health", () => ({ status: "ok", service: "dude-server" }));

  app.get("/api", () => ({
    name: "dude-server",
    specialists: registry.list().map((s) => ({ id: s.id, path: s.path })),
  }));

  return { app, registry };
}
