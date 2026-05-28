import {
  getAgentRunnerManifest,
  listAgentRunners,
  registerAgentRunnerManifest,
} from "./registry-store.js";
import type { AgentRunnerId, AgentRunnerManifest } from "./types.js";
import { DEFAULT_AGENT_RUNNER_ID } from "./types.js";

export interface AgentRunnerRegistry {
  list(): AgentRunnerManifest[];
  get(id: AgentRunnerId): AgentRunnerManifest | undefined;
  resolve(id?: AgentRunnerId | null): AgentRunnerId;
}

export function createAgentRunnerRegistry(
  customRunners: AgentRunnerManifest[] = [],
): AgentRunnerRegistry {
  for (const manifest of customRunners) {
    registerAgentRunnerManifest(manifest);
  }

  return {
    list() {
      return listAgentRunners();
    },

    get(id: AgentRunnerId) {
      return getAgentRunnerManifest(id);
    },

    resolve(id?: AgentRunnerId | null) {
      const resolved = (id || DEFAULT_AGENT_RUNNER_ID).trim();
      return resolved || DEFAULT_AGENT_RUNNER_ID;
    },
  };
}

export const defaultAgentRunnerRegistry = createAgentRunnerRegistry();
