import type { Elysia } from "elysia";

export function registerApiRoutes(app: Elysia) {
  app.get("/", () => ({ subagent: "data-analyst", ok: true }));
  app.get("/health", () => ({ status: "ok" }));
}
