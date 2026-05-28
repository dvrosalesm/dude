import type { Elysia } from "elysia";

export function registerApiRoutes(app: Elysia) {
  app.get("/", () => ({ specialist: "document-writer", ok: true }));
  app.get("/health", () => ({ status: "ok" }));
}
