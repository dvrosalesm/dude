import { config } from "./config.js";

const INTERNAL_REQUEST_TIMEOUT_MS = Number(
  process.env.INTERNAL_REQUEST_TIMEOUT_MS || 360_000,
);

const INTERNAL_BASE = () =>
  `http://127.0.0.1:${config.gatewayInternalPort}/v1/internal`;

function internalSessionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "x-dude-manifest-version": "1",
  };
  if (config.workspaceId) {
    headers["x-workspace-id"] = config.workspaceId;
  }
  if (config.specialistId) {
    headers["x-specialist-id"] = config.specialistId;
  }
  if (config.organizationId) {
    headers["x-organization-id"] = config.organizationId;
  }
  const dbPath =
    config.dbPath ||
    process.env.DB_LOCAL_PATH?.trim() ||
    process.env.DUDE_DB_PATH?.trim() ||
    "";
  if (dbPath) {
    headers["x-db-local-path"] = dbPath;
  }
  return headers;
}

async function parseJsonResponse(
  res: Response,
  label: string,
): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!res.ok) {
    return { error: `Request failed (${res.status}): ${text}` };
  }

  try {
    const parsed = JSON.parse(text || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { error: `${label} returned non-object JSON` };
  } catch {
    return {
      error: `${label} returned invalid JSON: ${text.slice(0, 500)}`,
    };
  }
}

export async function internalGet(
  path: string,
): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${INTERNAL_BASE()}${path}`, {
      headers: internalSessionHeaders(),
      signal: AbortSignal.timeout(15_000),
    });
    return await parseJsonResponse(res, `GET ${path}`);
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function internalPost(
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${INTERNAL_BASE()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...internalSessionHeaders(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(INTERNAL_REQUEST_TIMEOUT_MS),
    });
    return await parseJsonResponse(res, `POST ${path}`);
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
