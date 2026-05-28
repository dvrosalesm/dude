import { Elysia } from "elysia";
import { listServerRunners } from "../../lib/runners/index.js";
import { apiKeyAuth } from "./middleware.js";

export const runnerRoutes = new Elysia({ prefix: "/runners" })
  .use(apiKeyAuth)
  .get("/", () => ({
    runners: listServerRunners(),
  }));
