/**
 * Project hub — aggregates gtSession-linked subagent workspaces with
 * recent messages and artifact summaries for GT management + UI review.
 */

import { COLLECTION_REGISTRY } from "./collection-registry.js";
import {
  getWorkspaceConfigurations,
  getWorkspaceRecord,
  listWorkspaceMessages,
} from "./local-sqlite.js";

export interface GtSessionEntry {
  workspaceId: string;
  workspaceName?: string;
  lastInvokedAt?: string;
  lastTask?: string;
  lastAnswer?: string;
}

export interface GtSessionShape {
  projectName?: string;
  subagents?: Record<string, GtSessionEntry>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectArtifactSummary {
  collection: string;
  label: string;
  kind: "singleton" | "array";
  count?: number;
  preview?: string;
}

export interface ProjectAgentCard {
  subagentId: string;
  workspaceId: string;
  workspaceName: string;
  lastInvokedAt?: string;
  lastTask?: string;
  lastAnswer?: string;
  messageCount: number;
  recentMessages: Array<{ role: string; content: string; createdAt: string }>;
  artifacts: ProjectArtifactSummary[];
  suggestions: string[];
}

export interface ProjectHubSnapshot {
  gtWorkspaceId: string;
  projectName?: string;
  updatedAt?: string;
  agents: ProjectAgentCard[];
  suggestions: string[];
}

const SPECIALIST_ARTIFACT_HINTS: Record<string, string[]> = {
  "data-analyst": [],
  "design-branding": ["canvasSnapshot", "brandBook", "palettes"],
  "document-editor": ["documentEdits", "designDoc"],
  "document-writer": ["documentContent", "documentWriterEdits"],
};

function readGtSession(gtWorkspaceId: string): GtSessionShape | null {
  const config = getWorkspaceConfigurations(gtWorkspaceId);
  const raw = config.gtSession;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as GtSessionShape;
}

function summarizeArtifacts(
  subagentId: string,
  configurations: Record<string, unknown>,
): ProjectArtifactSummary[] {
  const preferred = SPECIALIST_ARTIFACT_HINTS[subagentId] ?? [];
  const keys = preferred.length
    ? preferred
    : Object.keys(COLLECTION_REGISTRY).filter((k) => k !== "gtSession");

  const summaries: ProjectArtifactSummary[] = [];

  for (const collection of keys) {
    const value = configurations[collection];
    if (value == null) continue;

    const spec = COLLECTION_REGISTRY[collection];
    const label = spec?.description?.split("(")[0]?.trim() || collection;

    if (Array.isArray(value)) {
      if (!value.length) continue;
      const first = value[0];
      const preview =
        first && typeof first === "object" && first !== null
          ? String(
              (first as Record<string, unknown>).title ??
                (first as Record<string, unknown>).name ??
                (first as Record<string, unknown>).id ??
                "",
            ).slice(0, 120)
          : undefined;
      summaries.push({
        collection,
        label,
        kind: "array",
        count: value.length,
        preview: preview || undefined,
      });
      continue;
    }

    if (typeof value === "object") {
      const preview = JSON.stringify(value).slice(0, 160);
      summaries.push({
        collection,
        label,
        kind: "singleton",
        preview: preview.length > 20 ? preview : undefined,
      });
    }
  }

  return summaries.slice(0, 6);
}

function buildAgentSuggestions(
  subagentId: string,
  workspaceId: string,
  workspaceName: string,
): string[] {
  return [
    `action:instruct-agent:${subagentId}:${workspaceId}:Instruct ${workspaceName}`,
    `action:review-agent:${subagentId}:${workspaceId}:Review ${workspaceName}`,
    `action:open-subagent:${subagentId}:${workspaceId}:Open ${workspaceName}`,
  ];
}

export function buildProjectHub(gtWorkspaceId: string): ProjectHubSnapshot {
  const session = readGtSession(gtWorkspaceId);
  const subagents = session?.subagents ?? {};
  const agents: ProjectAgentCard[] = [];

  for (const [subagentId, entry] of Object.entries(subagents)) {
    if (!entry?.workspaceId) continue;

    const record = getWorkspaceRecord(entry.workspaceId);
    const configurations =
      record?.configurations ??
      getWorkspaceConfigurations(entry.workspaceId);
    const workspaceName =
      entry.workspaceName || record?.name || `Workspace ${entry.workspaceId.slice(0, 8)}`;

    const recentMessages = listWorkspaceMessages(entry.workspaceId, 6);
    const artifacts = summarizeArtifacts(subagentId, configurations);

    agents.push({
      subagentId,
      workspaceId: entry.workspaceId,
      workspaceName,
      lastInvokedAt: entry.lastInvokedAt,
      lastTask: entry.lastTask,
      lastAnswer: entry.lastAnswer,
      messageCount: recentMessages.length,
      recentMessages: recentMessages.map((row) => ({
        role: row.role,
        content: row.content.slice(0, 500),
        createdAt: row.createdAt,
      })),
      artifacts,
      suggestions: buildAgentSuggestions(
        subagentId,
        entry.workspaceId,
        workspaceName,
      ),
    });
  }

  agents.sort((a, b) => {
    const aTime = a.lastInvokedAt ? Date.parse(a.lastInvokedAt) : 0;
    const bTime = b.lastInvokedAt ? Date.parse(b.lastInvokedAt) : 0;
    return bTime - aTime;
  });

  const suggestions: string[] = [];
  if (agents.length === 0) {
    suggestions.push("Start a project by asking me to delegate to a subagent");
  } else {
    for (const agent of agents.slice(0, 4)) {
      suggestions.push(...agent.suggestions);
    }
  }

  return {
    gtWorkspaceId,
    projectName: session?.projectName,
    updatedAt: session?.updatedAt,
    agents,
    suggestions: [...new Set(suggestions)],
  };
}
