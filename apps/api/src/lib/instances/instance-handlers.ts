import {
  getOrStartInstance,
  getInstance,
  hasRunningInstance,
  stopInstance,
} from "../instance-manager.js";
import {
  enrichMainAssistantConfig,
  MAIN_ASSISTANT_KIND,
} from "../agent-spawn.js";
import { resolveGatewaySubagentId, resolveToolHostWorkspaceId } from "../tool-host/resolve-subagent-id.js";
import {
  ensureWorkspaceForToolHost,
  type WorkspaceSnapshot,
} from "../workspace-tool-host-sync.js";
import type { QueryDto, SpawnInstanceDto } from "../types.js";
import { httpError } from "../../routes/http-error.js";
import { deleteSessionsForWorkspace } from "./session-store.js";

export async function spawnInstance(dto: SpawnInstanceDto) {
  if (!dto.workspaceId || !dto.subagentId || !dto.config) {
    throw httpError(
      "Missing required fields: workspaceId, subagentId, config",
      400,
    );
  }

  const gatewaySubagentId = resolveGatewaySubagentId(dto.subagentId);

  const scopeWorkspaceId = resolveToolHostWorkspaceId(dto.workspaceId);
  const snapshot =
    dto.workspaceSnapshot &&
    typeof dto.workspaceSnapshot === "object" &&
    typeof dto.workspaceSnapshot.id === "string"
      ? (dto.workspaceSnapshot as WorkspaceSnapshot)
      : undefined;

  ensureWorkspaceForToolHost({
    scopeWorkspaceId,
    gatewaySubagentId,
    snapshot,
  });

  const config =
    gatewaySubagentId === MAIN_ASSISTANT_KIND
      ? await enrichMainAssistantConfig(dto.config)
      : dto.config;

  const instance = await getOrStartInstance(
    dto.workspaceId,
    gatewaySubagentId,
    config,
  );

  return {
    id: instance.id,
    subagentId: instance.subagentId,
    organizationId: instance.organizationId,
    runner: instance.runner,
    gatewayHost: instance.gatewayHost,
    gatewayPort: instance.gatewayPort,
    status: instance.status,
    lastActivity: instance.lastActivity,
    pid: instance.pid,
    tmuxSession: instance.tmuxSession,
    tmuxAttach: instance.tmuxAttach,
  };
}

export async function queryWorkspace(workspaceId: string, dto: QueryDto) {
  if (!dto.query) {
    throw httpError("query is required", 400);
  }

  const instance = getInstance(workspaceId);
  if (!instance || instance.status !== "running") {
    throw httpError(`No running instance for workspace ${workspaceId}`, 404);
  }

  const url = `http://${instance.gatewayHost}:${instance.gatewayPort}/v1/query`;
  const queryRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: dto.query }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!queryRes.ok) {
    const errorText = await queryRes.text();
    throw httpError(`Query failed: ${errorText}`, queryRes.status);
  }

  return queryRes.json();
}

export async function stopWorkspace(workspaceId: string) {
  if (!hasRunningInstance(workspaceId)) {
    throw httpError(`No instance found for workspace ${workspaceId}`, 404);
  }

  await stopInstance(workspaceId);
  deleteSessionsForWorkspace(workspaceId);

  return { status: "stopped", workspaceId };
}
