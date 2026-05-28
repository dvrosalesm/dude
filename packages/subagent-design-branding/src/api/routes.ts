import type { Elysia } from "elysia";

export function registerApiRoutes(app: Elysia) {
  app.get("/", () => ({ subagent: "design-branding", ok: true }));
  app.get("/health", () => ({ status: "ok" }));
}
