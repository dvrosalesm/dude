import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { node } from "@elysiajs/node";
import { getSpecialistHostConfig } from "./lib/specialist-host-config.js";
import { createApiRoutes } from "./routes/api/index.js";
import { v1Routes } from "./routes/v1/index.js";
import { getLocalDb, getLocalDbPath } from "./lib/local-sqlite.js";
import { migrateLegacyDesktopDbs } from "./lib/local-db-path.js";
import { recoverStaleProcessingTurns } from "./lib/instances/turn-store.js";
import { loadCustomRunners } from "./lib/runners/bootstrap.js";

export function createApp() {
  const { app: apiRoutes, registry } = createApiRoutes(getSpecialistHostConfig());

  const app = new Elysia({ adapter: node() })
    .use(
      cors({
        origin: true,
        credentials: true,
      }),
    )
    .get("/healthz", () => ({ status: "ok" }))
    .use(apiRoutes)
    .use(v1Routes);

  return { app, registry };
}

export async function startServer() {
  const port = Number(process.env.DUDE_API_PORT ?? process.env.PORT ?? 8787);

  if (!process.env.GATEWAY_INTERNAL_PORT) {
    process.env.GATEWAY_INTERNAL_PORT = String(port);
  }
  if (!process.env.PORT) {
    process.env.PORT = String(port);
  }

  if (process.env.NODE_ENV !== "test") {
    migrateLegacyDesktopDbs();
  }

  getLocalDb();
  const recoveredTurns = recoverStaleProcessingTurns();
  if (recoveredTurns > 0) {
    console.log(
      `[dude-server] recovered ${recoveredTurns} interrupted chat turn(s) from durable store`,
    );
  }
  console.log(`[dude-server] local SQLite ready at ${getLocalDbPath()}`);

  loadCustomRunners();

  const { app, registry } = createApp();

  app.listen({
    port,
    hostname: "127.0.0.1",
  });

  console.log(
    `[dude-server] listening on http://127.0.0.1:${port} (api + gateway unified)`,
  );

  return { app, registry, port };
}

export default createApp;
