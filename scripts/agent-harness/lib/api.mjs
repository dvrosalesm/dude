import { API_URL } from "./env.mjs";

const DEFAULT_TIMEOUT_MS = 120_000;

export async function fetchJson(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { timeoutMs: _drop, ...init } = options;

  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    const message =
      body?.error || body?.message || text || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

export async function probeHealth() {
  const checks = [
    { name: "healthz", url: `${API_URL}/healthz` },
    { name: "v1-health", url: `${API_URL}/v1/health` },
    { name: "api-health", url: `${API_URL}/api/health` },
  ];

  const results = await Promise.all(
    checks.map(async ({ name, url }) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        return { name, url, ok: res.ok, status: res.status };
      } catch (error) {
        return {
          name,
          url,
          ok: false,
          status: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  return results;
}

export async function listWorkspaces(specialistId) {
  const q = new URLSearchParams({ specialistId });
  return fetchJson(
    `/v1/internal/assistant/specialist-workspaces?${q}`,
    { method: "GET", timeoutMs: 15_000 },
  );
}

export async function createWorkspace(specialistId, name) {
  return fetchJson("/v1/internal/assistant/specialist-workspaces", {
    method: "POST",
    body: JSON.stringify({ specialistId, name }),
    timeoutMs: 15_000,
  });
}

export async function runSpecialistChat({
  specialistId,
  message,
  workspaceId,
  context,
  timeoutMs,
}) {
  const body = { specialistId, message };
  if (workspaceId) body.workspaceId = workspaceId;
  if (context) body.context = context;

  return fetchJson("/v1/internal/assistant/specialist-run", {
    method: "POST",
    body: JSON.stringify(body),
    timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
}
