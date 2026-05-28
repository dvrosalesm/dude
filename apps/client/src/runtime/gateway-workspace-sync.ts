"use client";

import type { SubagentId } from "../types";
import { buildGatewayConfig } from "./gateway-prompts";
import {
  canUseGateway,
  gatewayRequest,
  gatewaySubagentId,
  gatewayWorkspaceId,
} from "./gateway-desktop";

export type WorkspaceSnapshotForGateway = {
  id: string;
  subagentId: string;
  name?: string;
  status?: "draft" | "active";
  configurations?: Record<string, unknown>;
};

/**
 * Upsert the UI workspace row into SQLite so internal collection reads
 * (hydration, edit_presentation) see the same configurations as local storage.
 */
export async function syncWorkspaceSnapshotToGateway(
  subagentId: SubagentId,
  snapshot: WorkspaceSnapshotForGateway,
): Promise<void> {
  if (!canUseGateway() || !snapshot.id?.trim()) return;

  const instanceId = gatewayWorkspaceId(subagentId, snapshot.id);
  await gatewayRequest("/instances", {
    method: "POST",
    timeoutMs: 120_000,
    body: {
      workspaceId: instanceId,
      subagentId: gatewaySubagentId(subagentId),
      config: buildGatewayConfig(subagentId),
      workspaceSnapshot: {
        id: snapshot.id,
        subagentId: snapshot.subagentId,
        name: snapshot.name,
        status: snapshot.status,
        configurations: snapshot.configurations,
      },
    },
  });
}
