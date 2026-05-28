import {
  DEFAULT_AGENT_RUNNER_ID,
  isKnownAgentRunnerId,
  isValidAgentRunnerSlug,
  normalizeStoredAgentRunnerId,
  type AgentRunnerId,
} from "@dude/sdk/runner";
import { getAssistantConfig } from "./local-sqlite.js";

export function resolveDefaultRunner(): AgentRunnerId {
  const fromEnv = (process.env.AGENT_RUNNER || process.env.DEFAULT_AGENT_RUNNER || "").trim();
  if (!fromEnv) return DEFAULT_AGENT_RUNNER_ID;
  if (isKnownAgentRunnerId(fromEnv) || isValidAgentRunnerSlug(fromEnv)) {
    return fromEnv;
  }
  return DEFAULT_AGENT_RUNNER_ID;
}

/**
 * Runner for API spawns and harness — prefers Settings → AI Runners synced to
 * local SQLite, then AGENT_RUNNER env, then Pi.
 */
export function resolveConfiguredAgentRunner(): AgentRunnerId {
  const stored = getAssistantConfig().agent_runner?.trim();
  if (stored) {
    return normalizeStoredAgentRunnerId(stored);
  }
  return resolveDefaultRunner();
}
