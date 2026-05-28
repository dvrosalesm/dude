import { Elysia } from "elysia";
import { HttpError } from "../http-error.js";
import {
  restoreToolHostEnv,
  snapshotToolHostEnv,
} from "../../lib/tool-host/session.js";
import { withRequestDbPath } from "../../lib/request-db-context.js";
import { getLocalDbPath } from "../../lib/local-sqlite.js";

function readInternalDbPath(request: Request): string | undefined {
  return request.headers.get("x-db-local-path")?.trim() || undefined;
}

function restoreInternalDbContext(request: Request) {
  const req = request as Request & {
    __internalDbSnap?: ReturnType<typeof snapshotToolHostEnv>;
  };
  if (!req.__internalDbSnap) return;
  restoreToolHostEnv(req.__internalDbSnap);
  delete req.__internalDbSnap;
}

function getExpectedApiKey(): string {
  return (
    process.env.GATEWAY_API_KEY ||
    process.env.PIMONO_GATEWAY_API_KEY ||
    ""
  );
}

export function isLocalhostAddress(address: string | undefined): boolean {
  if (!address) return true;
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}

/** Bearer token auth for public /v1 routes (matches agentsgt-gateway ApiKeyGuard). */
export const apiKeyAuth = new Elysia({ name: "api-key-auth" }).onBeforeHandle(
  ({ request, set }) => {
    const expected = getExpectedApiKey();
    if (!expected) return;

    const authHeader = request.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      set.status = 401;
      return { error: "Missing API key" };
    }

    const token = authHeader.slice(7);
    if (token !== expected) {
      set.status = 401;
      return { error: "Invalid API key" };
    }
  },
);

/** Apply x-db-local-path from internal API callers (gateway runtime, nested tool fetches). */
export const internalDbContext = new Elysia({ name: "internal-db-context" })
  .onBeforeHandle(({ request }) => {
    const dbPath = readInternalDbPath(request);
    if (!dbPath) return;

    const req = request as Request & {
      __internalDbSnap?: ReturnType<typeof snapshotToolHostEnv>;
    };
    req.__internalDbSnap = snapshotToolHostEnv();
    process.env.DB_LOCAL_PATH = dbPath;
  })
  .onAfterHandle(({ request }) => {
    restoreInternalDbContext(request);
  })
  .onError(({ request }) => {
    restoreInternalDbContext(request);
  });

export async function withInternalRequestDb<T>(
  request: Request,
  fn: () => Promise<T>,
): Promise<T> {
  const dbPath = readInternalDbPath(request) || getLocalDbPath();
  if (!dbPath) return fn();
  return withRequestDbPath(dbPath, fn);
}

/** Restrict routes to localhost callers (tool-host internal callbacks). */
export const localhostOnly = new Elysia({ name: "localhost-only" }).onBeforeHandle(
  ({ request, set, server }) => {
    const ip =
      server?.requestIP?.(request)?.address ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "127.0.0.1";

    if (!isLocalhostAddress(ip)) {
      set.status = 403;
      return { error: "Forbidden" };
    }
  },
);

export function handleRouteError(error: unknown, set: { status?: number | string }) {
  if (error instanceof HttpError) {
    set.status = error.status;
    return { error: error.message, message: error.message };
  }

  const message = error instanceof Error ? error.message : "Internal server error";
  console.error("[server] route error:", error);
  set.status = 500;
  return { error: message, message };
}
