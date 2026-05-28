import type { Elysia } from "elysia";

export function registerApiRoutes(app: Elysia) {
  app.get("/", () => ({ subagent: "document-writer", ok: true }));
  app.get("/health", () => ({ status: "ok" }));
}
