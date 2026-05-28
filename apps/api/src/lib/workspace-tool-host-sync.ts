/**
 * Keep subagent workspace rows in local SQLite aligned with agent tool-host reads/writes.
 *
 * The UI stores workspaces in the same SQLite file (desktop) or in browser local state (dev).
 * Agent tools call /v1/internal/workspace/:id/* which requires a workspace row with
 * non-empty configurations — otherwise slide edits fail with "Workspace … not found".
 */

import {
  createWorkspaceRecord,
  getWorkspaceRecord,
  setWorkspaceConfigurations,
} from "./local-sqlite.js";

export function uiSubagentIdFromGateway(gatewayKind: string): string {
  if (gatewayKind === "document-editor") return "presentation-editor";
  return gatewayKind;
}

export function buildDefaultWorkspaceConfigurations(
  subagentId: string,
  workspaceId: string,
): Record<string, unknown> {
  const base = { subagent: subagentId, version: 1, workspaceId };
  switch (subagentId) {
    case "document-writer":
      return {
        ...base,
        description: "",
        template: "default",
        contextDocuments: [],
        documentContent: { blocks: [], title: "" },
      };
    case "image-studio":
      return { ...base, gallery: [] };
    case "data-analyst":
      return { ...base, protected: false };
    case "presentation-editor":
    case "document-editor":
      return {
        ...base,
        documentType: "pptx",
        outline: ["Opening", "Problem", "Approach", "Next steps"],
        slides: [],
        revisions: [],
      };
    case "prospect":
      return { ...base, landingPages: [] };
    default:
      return base;
  }
}

export interface WorkspaceSnapshot {
  id: string;
  subagentId: string;
  name?: string;
  status?: "draft" | "active";
  configurations?: Record<string, unknown>;
}

function mergeConfigurations(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  return { ...existing, ...incoming };
}

/**
 * Ensure `scopeWorkspaceId` exists in SQLite before agent tools read/write collections.
 * Optionally upsert configurations from the client snapshot (browser dev / stale API DB).
 */
export function ensureWorkspaceForToolHost(input: {
  scopeWorkspaceId: string;
  gatewaySubagentId: string;
  snapshot?: WorkspaceSnapshot | null;
}): void {
  const scopeWorkspaceId = input.scopeWorkspaceId.trim();
  if (!scopeWorkspaceId) return;

  const uiSubagentId = uiSubagentIdFromGateway(input.gatewaySubagentId);
  const defaults = buildDefaultWorkspaceConfigurations(
    uiSubagentId,
    scopeWorkspaceId,
  );

  const snapshot = input.snapshot;
  const snapshotConfig =
    snapshot?.configurations && typeof snapshot.configurations === "object"
      ? snapshot.configurations
      : {};

  const existing = getWorkspaceRecord(scopeWorkspaceId);

  if (!existing) {
    const configurations = mergeConfigurations(defaults, snapshotConfig);
    createWorkspaceRecord({
      id: scopeWorkspaceId,
      subagentId:
        snapshot?.subagentId?.trim() || uiSubagentId,
      name: snapshot?.name?.trim() || "Untitled workspace",
      status: snapshot?.status === "active" ? "active" : "draft",
      configurations,
    });
    console.log(
      `[workspace-sync] Created SQLite workspace ${scopeWorkspaceId} for ${uiSubagentId}`,
    );
    return;
  }

  const merged = mergeConfigurations(
    mergeConfigurations(defaults, existing.configurations),
    snapshotConfig,
  );

  if (Object.keys(merged).length === 0) {
    setWorkspaceConfigurations(scopeWorkspaceId, defaults);
    return;
  }

  const existingJson = JSON.stringify(existing.configurations);
  const mergedJson = JSON.stringify(merged);
  if (existingJson !== mergedJson) {
    setWorkspaceConfigurations(scopeWorkspaceId, merged);
    console.log(
      `[workspace-sync] Updated SQLite configurations for ${scopeWorkspaceId}`,
    );
  }
}
