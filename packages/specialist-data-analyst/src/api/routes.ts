import type { Elysia } from "elysia";

export function registerApiRoutes(app: Elysia) {
  app.get("/", () => ({ specialist: "data-analyst", ok: true }));
  app.get("/health", () => ({ status: "ok" }));
}
