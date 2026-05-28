import type { SubagentId } from "@dude/client-types";

export type GatewayWorkspaceSnapshot = {
  id: string;
  subagentId: string;
  name?: string;
  status?: "draft" | "active";
  configurations?: Record<string, unknown>;
};

export type GatewayWorkspaceSync = (
  subagentId: SubagentId,
  snapshot: GatewayWorkspaceSnapshot,
) => Promise<void>;

let syncWorkspaceToGatewayImpl: GatewayWorkspaceSync | null = null;

export function bindGatewayWorkspaceSync(sync: GatewayWorkspaceSync): void {
  syncWorkspaceToGatewayImpl = sync;
}

export async function syncWorkspaceToGateway(
  subagentId: SubagentId,
  snapshot: GatewayWorkspaceSnapshot,
): Promise<void> {
  if (!syncWorkspaceToGatewayImpl) return;
  await syncWorkspaceToGatewayImpl(subagentId, snapshot);
}
