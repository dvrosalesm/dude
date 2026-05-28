import type { Elysia } from "elysia";

export function registerApiRoutes(app: Elysia) {
  app.get("/", () => ({ specialist: "design-branding", ok: true }));
  app.get("/health", () => ({ status: "ok" }));
}
