import type {
  AgentDispatchRequest,
  AgentToolHostCatalogResponse,
  AgentToolHostExecuteResponse,
} from "@dude/sdk/runner";
import {
  AGENT_DISPATCH_ROUTES,
  AGENT_TOOL_HOST_ROUTES,
} from "@dude/sdk/runner";
import {
  resolveGatewaySpecialistId,
  resolveToolHostWorkspaceId,
} from "../tool-host/resolve-specialist-id.js";
import {
  dispatchViaManifest,
  loadRunnerSessionManifestFromEnv,
  resolveMainApiPort,
  sessionHeadersFromManifest,
  type RunnerSessionManifest,
} from "../runner-session-manifest.js";

export interface ToolHostClientConfig {
  baseUrl?: string;
  workspaceId: string;
  specialistId: string;
  organizationId: string;
  runner: string;
}

function resolveManifest(): RunnerSessionManifest | null {
  return loadRunnerSessionManifestFromEnv();
}

function toolHostBaseUrl(config: ToolHostClientConfig): string {
  const manifest = resolveManifest();
  if (manifest) {
    return manifest.internalApi.baseUrl.replace(/\/+$/, "");
  }

  const port = resolveMainApiPort();
  return (config.baseUrl || `http://127.0.0.1:${port}`).replace(/\/+$/, "");
}

function sessionHeaders(config: ToolHostClientConfig): Record<string, string> {
  const manifest = resolveManifest();
  if (manifest) {
    return sessionHeadersFromManifest(manifest);
  }

  const headers: Record<string, string> = {
    "x-workspace-id": config.workspaceId,
    "x-specialist-id": config.specialistId,
    "x-organization-id": config.organizationId,
    "x-runner-id": config.runner,
  };

  if (process.env.ENABLED_SPECIALISTS) {
    headers["x-enabled-specialists"] = process.env.ENABLED_SPECIALISTS;
  }
  if (process.env.DB_LOCAL_PATH) {
    headers["x-db-local-path"] = process.env.DB_LOCAL_PATH;
  }

  return headers;
}

export function toolHostConfigFromEnv(): ToolHostClientConfig {
  const manifest = resolveManifest();
  if (manifest) {
    return {
      baseUrl: manifest.internalApi.baseUrl,
      workspaceId: manifest.workspaceId,
      specialistId: manifest.specialistId,
      organizationId: manifest.organizationId,
      runner: manifest.runner,
    };
  }

  return {
    workspaceId: resolveToolHostWorkspaceId(process.env.WORKSPACE_ID || ""),
    specialistId: resolveGatewaySpecialistId(process.env.SPECIALIST_ID || ""),
    organizationId: process.env.ORGANIZATION_ID || "",
    runner: process.env.RUNNER_ID || "pi",
  };
}

export async function fetchToolHostCatalog(
  config: ToolHostClientConfig,
): Promise<AgentToolHostCatalogResponse> {
  const url = `${toolHostBaseUrl(config)}${AGENT_TOOL_HOST_ROUTES.catalog}`;
  const res = await fetch(url, {
    headers: sessionHeaders(config),
    signal: AbortSignal.timeout(30_000),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: unknown }).error)
        : `Tool host catalog failed (${res.status})`;
    throw new Error(message);
  }

  return data as AgentToolHostCatalogResponse;
}

export async function fetchAgentCatalog(
  config: ToolHostClientConfig,
): Promise<AgentToolHostCatalogResponse> {
  const url = `${toolHostBaseUrl(config)}${AGENT_DISPATCH_ROUTES.catalog}`;
  const res = await fetch(url, {
    headers: sessionHeaders(config),
    signal: AbortSignal.timeout(30_000),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: unknown }).error)
        : `Agent catalog failed (${res.status})`;
    throw new Error(message);
  }

  return data as AgentToolHostCatalogResponse;
}

export async function dispatchAgentRemote(
  config: ToolHostClientConfig,
  request: AgentDispatchRequest,
): Promise<AgentToolHostExecuteResponse> {
  const manifest = resolveManifest();
  if (manifest) {
    return dispatchViaManifest(manifest, request);
  }

  const action = request.action?.trim();
  if (!action) {
    throw new Error("action is required");
  }

  const url = `${toolHostBaseUrl(config)}${AGENT_DISPATCH_ROUTES.dispatch}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...sessionHeaders(config),
    },
    body: JSON.stringify({
      action,
      payload: request.payload ?? {},
      callId: request.callId?.trim() || `dispatch-${Date.now()}`,
    }),
    signal: AbortSignal.timeout(360_000),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: unknown }).error)
        : `Agent dispatch failed (${res.status})`;
    throw new Error(message);
  }

  return data as AgentToolHostExecuteResponse;
}

export async function executeHostedToolRemote(
  config: ToolHostClientConfig,
  request: {
    tool: string;
    toolCallId: string;
    arguments: Record<string, unknown>;
  },
): Promise<AgentToolHostExecuteResponse> {
  const url = `${toolHostBaseUrl(config)}${AGENT_TOOL_HOST_ROUTES.execute}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...sessionHeaders(config),
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(360_000),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: unknown }).error)
        : `Tool host execute failed (${res.status})`;
    throw new Error(message);
  }

  return data as AgentToolHostExecuteResponse;
}

export function openAiToolsFromCatalog(
  catalog: AgentToolHostCatalogResponse,
): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return catalog.tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function toolResultText(result: AgentToolHostExecuteResponse): string {
  return result.content
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n");
}
