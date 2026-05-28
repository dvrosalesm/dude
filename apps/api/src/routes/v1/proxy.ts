import { Elysia } from "elysia";
import { getInstance } from "../../lib/instance-manager.js";
import { apiKeyAuth } from "./middleware.js";

export const proxyRoutes = new Elysia({ prefix: "/proxy" })
  .use(apiKeyAuth)
  .all("/:workspaceId/*", async ({ params, request, set }) => {
    const workspaceId = params.workspaceId;
    const instance = getInstance(workspaceId);
    if (!instance || instance.status !== "running") {
      set.status = 404;
      return { error: `No running instance for workspace ${workspaceId}` };
    }

    const url = new URL(request.url);
    const prefix = `/v1/proxy/${workspaceId}`;
    const subPath = url.pathname.slice(prefix.length) || "/";
    const targetUrl = `http://${instance.gatewayHost}:${instance.gatewayPort}${subPath}${url.search}`;

    try {
      const headers: Record<string, string> = {};
      const contentType = request.headers.get("content-type");
      if (contentType) headers["Content-Type"] = contentType;

      const fetchOptions: RequestInit = {
        method: request.method,
        headers,
        signal: AbortSignal.timeout(300_000),
      };

      if (request.method !== "GET" && request.method !== "HEAD") {
        fetchOptions.body = await request.text();
      }

      const proxyRes = await fetch(targetUrl, fetchOptions);
      const proxyContentType = proxyRes.headers.get("content-type") || "";

      if (proxyContentType.includes("text/event-stream")) {
        set.headers["Content-Type"] = "text/event-stream";
        set.headers["Cache-Control"] = "no-cache";
        set.headers["Connection"] = "keep-alive";
        set.status = proxyRes.status;
        return proxyRes.body;
      }

      const body = await proxyRes.text();
      set.status = proxyRes.status;
      set.headers["Content-Type"] = proxyContentType || "application/json";
      return body;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Proxy request failed";
      set.status = 502;
      return { error: message };
    }
  });
