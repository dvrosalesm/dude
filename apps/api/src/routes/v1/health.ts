import { Elysia } from "elysia";
import { listInstances } from "../../lib/instance-manager.js";

export const gatewayHealthRoutes = new Elysia({ prefix: "/health" }).get(
  "/",
  () => {
    const instances = listInstances();
    const running = instances.filter((i) => i.status === "running").length;
    return {
      status: "ok",
      uptime: process.uptime(),
      instances: {
        total: instances.length,
        running,
      },
    };
  },
);
