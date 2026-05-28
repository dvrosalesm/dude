import {
  getWorkspaceConfigurations,
  setWorkspaceConfigurations,
  getLocalDbPath,
  getWorkspaceRecord,
} from "../../../lib/local-sqlite.js";

export async function getWorkspaceConfig(
  workspaceId: string,
): Promise<Record<string, unknown>> {
  const config = getWorkspaceConfigurations(workspaceId);
  if (config && Object.keys(config).length > 0) {
    return config;
  }

  const record = getWorkspaceRecord(workspaceId);
  if (record) {
    if (Object.keys(record.configurations).length > 0) {
      return record.configurations;
    }
    throw new Error(
      `Workspace ${workspaceId} has no configurations (db: ${getLocalDbPath()})`,
    );
  }

  throw new Error(
    `Workspace ${workspaceId} not found (db: ${getLocalDbPath()})`,
  );
}

export async function updateWorkspaceConfig(
  workspaceId: string,
  config: Record<string, unknown>,
): Promise<void> {
  setWorkspaceConfigurations(workspaceId, config);
}
