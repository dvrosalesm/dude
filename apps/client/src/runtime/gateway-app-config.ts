"use client";

import skillsLock from "../../../../skills-lock.json";
import {
  DUDE_PREFERENCES_KEY,
  readStoredPreferences,
  type DudePreferences,
  type LocalMcpServerConfig,
  type LocalSkillConfig,
  type LocalSourceToolConfig,
} from "../preferences";
import type {
  AppCapabilityRequest,
  GatewayConversationMessage,
  LocalSkillCatalogEntry,
} from "./gateway-types";
import { gatewayRequest } from "./gateway-desktop";

export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown) {
  if (typeof value === "string") {
    return value.split(/\s+/).map((item) => item.trim()).filter(Boolean);
  }
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string");
  return items.length ? items : undefined;
}

function asStringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key, entryValue]) => key.trim() && typeof entryValue === "string")
    .map(([key, entryValue]) => [key.trim(), entryValue as string]);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function appConfigId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localSkillCatalog(): LocalSkillCatalogEntry[] {
  const skills =
    skillsLock && typeof skillsLock === "object" && "skills" in skillsLock
      ? (skillsLock.skills as Record<string, { source?: unknown; sourceType?: unknown }>)
      : {};
  return Object.entries(skills).map(([name, value]) => ({
    name,
    source: typeof value.source === "string" ? value.source : "registry",
    sourceType: typeof value.sourceType === "string" ? value.sourceType : "registry",
  }));
}

function skillReference(match: LocalSkillCatalogEntry) {
  if (match.sourceType === "github") return `${match.source}/${match.name}`;
  return match.name;
}

function findLocalSkills(query: string, limit = 8): LocalSkillCatalogEntry[] {
  const catalog = localSkillCatalog();
  const normalized = query.trim().toLowerCase();
  if (!normalized) return catalog.slice(0, limit);
  const terms = normalized.split(/\s+/).filter(Boolean);
  return catalog
    .map((entry) => {
      const haystack = `${entry.name} ${entry.source} ${entry.sourceType}`.toLowerCase();
      const exact = entry.name.toLowerCase() === normalized ? 100 : 0;
      const includes = haystack.includes(normalized) ? 25 : 0;
      const termScore = terms.reduce(
        (score, term) => score + (haystack.includes(term) ? 5 : 0),
        0,
      );
      return { entry, score: exact + includes + termScore };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map((item) => item.entry);
}

function upsertByIdOrName<T extends { id: string; name: string }>(
  items: T[],
  next: T,
) {
  const existingIndex = items.findIndex(
    (item) =>
      item.id === next.id ||
      item.name.trim().toLowerCase() === next.name.trim().toLowerCase(),
  );
  if (existingIndex >= 0) {
    const copy = [...items];
    copy[existingIndex] = { ...copy[existingIndex], ...next };
    return copy;
  }
  return [...items, next];
}

function removeByIdOrName<T extends { id?: string; name?: string }>(
  items: T[],
  request: AppCapabilityRequest,
) {
  const target = asString(request.id) ?? asString(request.config?.id) ?? asString(request.config?.name);
  if (!target) return { items, removed: false };
  const normalized = target.toLowerCase();
  const next = items.filter(
    (item) =>
      item.id?.toLowerCase() !== normalized &&
      item.name?.trim().toLowerCase() !== normalized,
  );
  return { items: next, removed: next.length !== items.length };
}

function writeStoredPreferences(preferences: DudePreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DUDE_PREFERENCES_KEY, JSON.stringify(preferences));
  window.dispatchEvent(
    new CustomEvent("dude-preferences-changed", { detail: preferences }),
  );
}

function buildLocalMcpServer(config: Record<string, unknown>): LocalMcpServerConfig {
  const transport =
    config.transport === "stdio" || config.transport === "sse" || config.transport === "http"
      ? config.transport
      : "http";
  return {
    id: asString(config.id) ?? appConfigId("mcp"),
    name: asString(config.name) ?? "",
    transport,
    url: asString(config.url),
    command: asString(config.command),
    args: asStringArray(config.args),
    env: asStringRecord(config.env),
    enabled: config.enabled !== false,
  };
}

function buildLocalSourceTool(config: Record<string, unknown>): LocalSourceToolConfig {
  return {
    id: asString(config.id) ?? appConfigId("tool"),
    name: asString(config.name) ?? "",
    description: asString(config.description) ?? "",
    endpoint: asString(config.endpoint),
    schema:
      config.schema && typeof config.schema === "object" && !Array.isArray(config.schema)
        ? (config.schema as Record<string, unknown>)
        : undefined,
    enabled: config.enabled !== false,
  };
}

function buildLocalSkill(config: Record<string, unknown>, query?: string): LocalSkillConfig {
  const name = asString(config.name) ?? query?.trim() ?? "";
  const match = findLocalSkills(asString(config.reference) ?? name, 1)[0];
  const source =
    config.source === "local" ||
    config.source === "github" ||
    config.source === "inline" ||
    config.source === "registry"
      ? config.source
      : match?.sourceType === "github"
        ? "github"
      : "registry";
  return {
    id: asString(config.id) ?? appConfigId("skill"),
    name,
    description: asString(config.description) ?? "",
    source,
    reference: asString(config.reference) ?? (match ? skillReference(match) : name),
    trigger: asString(config.trigger),
    instructions: asString(config.instructions),
    config: asStringRecord(config.config),
    enabled: config.enabled !== false,
  };
}

export async function readLocalGtSession(workspaceId: string) {
  return gatewayRequest<Record<string, unknown>>(
    `/internal/workspace/${encodeURIComponent(workspaceId)}/collection/gtSession`,
    { timeoutMs: 30_000 },
  ).catch(() => null);
}

export async function applyLocalAppConfigurationRequests(
  workspaceId: string,
  previousGtSession?: Record<string, unknown> | null,
) {
  const gtSession = await readLocalGtSession(workspaceId);
  if (!gtSession) return null;

  const requests = Array.isArray(gtSession.appConfigurationRequests)
    ? (gtSession.appConfigurationRequests as unknown[])
        .map((item) => asObject(item) as AppCapabilityRequest)
        .filter((item) => item.action || item.kind || item.query || item.config)
    : [];
  if (!requests.length) return null;

  let preferences = readStoredPreferences();
  const results: string[] = [];

  for (const request of requests.slice(0, 20)) {
    const action = request.action ?? "upsert";
    const config = asObject(request.config);
    const label =
      asString(config.name) ??
      asString(request.id) ??
      asString(request.query) ??
      request.kind ??
      "app configuration";

    if (action === "list") {
      const counts = preferences.appConfigurations;
      results.push(
        `${counts.mcpServers.length} MCP server(s), ${counts.sourceTools.length} source tool(s), ${counts.skills.length} skill(s) configured.`,
      );
      continue;
    }

    if (action === "find_skill") {
      const matches = findLocalSkills(asString(request.query) ?? label);
      results.push(
        matches.length
          ? `Found skills: ${matches.map((match) => `${match.name} (${skillReference(match)})`).join(", ")}.`
          : "No matching skills were found in the local skills catalog.",
      );
      continue;
    }

    if (request.kind === "mcp_server") {
      if (action === "remove") {
        const removed = removeByIdOrName(preferences.appConfigurations.mcpServers, request);
        preferences = {
          ...preferences,
          appConfigurations: {
            ...preferences.appConfigurations,
            mcpServers: removed.items,
          },
        };
        results.push(
          removed.removed ? `Removed MCP server "${label}".` : `Could not find MCP server "${label}".`,
        );
        continue;
      }
      const server = buildLocalMcpServer(config);
      if (!server.name) {
        results.push("MCP server name is required.");
        continue;
      }
      preferences = {
        ...preferences,
        appConfigurations: {
          ...preferences.appConfigurations,
          mcpServers: upsertByIdOrName(
            preferences.appConfigurations.mcpServers,
            server,
          ),
        },
      };
      results.push(`Installed MCP server "${server.name}".`);
      continue;
    }

    if (request.kind === "source_tool") {
      if (action === "remove") {
        const removed = removeByIdOrName(preferences.appConfigurations.sourceTools, request);
        preferences = {
          ...preferences,
          appConfigurations: {
            ...preferences.appConfigurations,
            sourceTools: removed.items,
          },
        };
        results.push(
          removed.removed ? `Removed source tool "${label}".` : `Could not find source tool "${label}".`,
        );
        continue;
      }
      const tool = buildLocalSourceTool(config);
      if (!tool.name || !tool.description) {
        results.push("Source tool name and description are required.");
        continue;
      }
      preferences = {
        ...preferences,
        appConfigurations: {
          ...preferences.appConfigurations,
          sourceTools: upsertByIdOrName(
            preferences.appConfigurations.sourceTools,
            tool,
          ),
        },
      };
      results.push(`Installed source tool "${tool.name}".`);
      continue;
    }

    if (request.kind === "skill") {
      if (action === "remove") {
        const removed = removeByIdOrName(preferences.appConfigurations.skills, request);
        preferences = {
          ...preferences,
          appConfigurations: {
            ...preferences.appConfigurations,
            skills: removed.items,
          },
        };
        results.push(
          removed.removed ? `Removed skill "${label}".` : `Could not find skill "${label}".`,
        );
        continue;
      }
      const skill = buildLocalSkill(config, request.query);
      if (!skill.name) {
        results.push("Skill name is required.");
        continue;
      }
      preferences = {
        ...preferences,
        appConfigurations: {
          ...preferences.appConfigurations,
          skills: upsertByIdOrName(preferences.appConfigurations.skills, skill),
        },
      };
      results.push(`Installed skill "${skill.name}".`);
    }
  }

  writeStoredPreferences(preferences);

  const nextGtSession = {
    ...(previousGtSession ?? {}),
    ...gtSession,
    appConfigurationRequests: [],
    appConfigurationLastResult: {
      processedAt: new Date().toISOString(),
      results,
    },
  };
  await gatewayRequest(
    `/internal/workspace/${encodeURIComponent(workspaceId)}/collection`,
    {
      method: "POST",
      timeoutMs: 30_000,
      body: {
        collection: "gtSession",
        data: nextGtSession,
      },
    },
  ).catch(() => null);

  return results.length ? `\n\nSetup result: ${results.join(" ")}` : null;
}
