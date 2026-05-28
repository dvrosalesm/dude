import { listBuiltinRunnerIds } from "./builtins.js";
import { getBuiltinRunnerManifest } from "./manifests.js";
import type { AgentRunnerId, AgentRunnerManifest } from "./types.js";
import { DEFAULT_AGENT_RUNNER_ID } from "./types.js";

const customManifests = new Map<string, AgentRunnerManifest>();

const AGENT_RUNNER_ID_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/i;

export function isValidAgentRunnerSlug(id: string): boolean {
  return AGENT_RUNNER_ID_PATTERN.test(id.trim());
}

export function registerAgentRunnerManifest(manifest: AgentRunnerManifest): void {
  customManifests.set(manifest.id, manifest);
}

export function getRegisteredCustomRunners(): AgentRunnerManifest[] {
  return [...customManifests.values()];
}

export function getAgentRunnerManifest(
  id: string,
): AgentRunnerManifest | undefined {
  const trimmed = id.trim();
  if (!trimmed) return undefined;
  return getBuiltinRunnerManifest(trimmed) ?? customManifests.get(trimmed);
}

export function isKnownAgentRunnerId(id: string): id is AgentRunnerId {
  const trimmed = id.trim();
  if (!trimmed) return false;
  return !!getAgentRunnerManifest(trimmed);
}

export function normalizeStoredAgentRunnerId(raw: unknown): AgentRunnerId {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id) return DEFAULT_AGENT_RUNNER_ID;
  if (isKnownAgentRunnerId(id)) return id;
  if (isValidAgentRunnerSlug(id)) return id;
  return DEFAULT_AGENT_RUNNER_ID;
}

export function listAgentRunners(): AgentRunnerManifest[] {
  const seen = new Set<string>();
  const result: AgentRunnerManifest[] = [];

  for (const id of listBuiltinRunnerIds()) {
    const manifest = getBuiltinRunnerManifest(id);
    if (manifest && !seen.has(manifest.id)) {
      seen.add(manifest.id);
      result.push(manifest);
    }
  }

  for (const manifest of customManifests.values()) {
    if (!seen.has(manifest.id)) {
      seen.add(manifest.id);
      result.push(manifest);
    }
  }

  return result;
}
