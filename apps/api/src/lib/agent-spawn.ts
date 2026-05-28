/**
 * Unified agent spawn helpers — every agent (Dude + specialists) gets its own
 * background runner process (pi / codex / hermes).
 */

import {
  DEFAULT_AGENT_RUNNER_ID,
  MAIN_ASSISTANT_KIND,
  buildMainAssistantInstanceId,
  buildSpecialistInstanceId,
  canonicalAgentKind,
  isKnownAgentRunnerId,
  isValidAgentRunnerSlug,
  type AgentRunnerId,
} from "@dude/sdk/runner";
import { createSpecialistRegistry, getDelegableSpecialists } from "@dude/sdk";
import type { AgentConfig } from "./types.js";
import { getSpecialistHostConfig } from "./specialist-host-config.js";
import { getAssistantConfig } from "./assistant-store.js";
import {
  composeSystemPrompt,
  type SpecialistRosterEntry,
} from "./assistant-prompt.js";
import { getSpecialistMeta } from "./tool-host/registry.js";

export {
  MAIN_ASSISTANT_KIND,
  buildMainAssistantInstanceId,
  buildSpecialistInstanceId,
  canonicalAgentKind,
};

let registry: ReturnType<typeof createSpecialistRegistry> | null = null;

function getRegistry() {
  if (!registry) {
    registry = createSpecialistRegistry(getSpecialistHostConfig());
  }
  return registry;
}

export function resolveDefaultRunner(): AgentRunnerId {
  const fromEnv = (process.env.AGENT_RUNNER || process.env.DEFAULT_AGENT_RUNNER || "").trim();
  if (!fromEnv) return DEFAULT_AGENT_RUNNER_ID;
  if (isKnownAgentRunnerId(fromEnv) || isValidAgentRunnerSlug(fromEnv)) {
    return fromEnv;
  }
  return DEFAULT_AGENT_RUNNER_ID;
}

export function listDelegableAgentKinds() {
  return getDelegableSpecialists(getRegistry()).map((specialist) => ({
    id: specialist.id,
    label: specialist.gatewayLabel,
    description: specialist.gatewayDescription,
  }));
}

function buildSpecialistRoster(
  enabled: NonNullable<AgentConfig["enabledSpecialists"]>,
): SpecialistRosterEntry[] {
  return enabled.map((entry) => {
    const plugin = getRegistry().getById(entry.id);
    const meta = getSpecialistMeta(entry.id);
    return {
      id: entry.id,
      label: entry.label ?? plugin?.manifest.gatewayLabel,
      description:
        entry.description ?? plugin?.manifest.gatewayDescription,
      scope: plugin?.local?.summary.scope,
      collections: meta.collections.length ? meta.collections : undefined,
    };
  });
}

/** Compose GT system prompt + specialist roster for main-assistant spawns. */
export async function enrichMainAssistantConfig(
  config: AgentConfig,
): Promise<AgentConfig> {
  const enabled =
    config.enabledSpecialists?.length
      ? config.enabledSpecialists
      : listDelegableAgentKinds();

  const assistantConfig = await getAssistantConfig();
  const localPrompt = config.systemPrompt?.trim() || "";

  const systemPrompt = await composeSystemPrompt({
    config: assistantConfig,
    isMainAssistant: true,
    specialist: null,
    extraPrompt: localPrompt,
    enabledSpecialists: buildSpecialistRoster(enabled),
  });

  return {
    ...config,
    systemPrompt,
    enabledSpecialists: enabled,
    maxIterations:
      config.maxIterations ?? assistantConfig.max_iterations ?? 12,
    approvalMode: config.approvalMode ?? assistantConfig.approval_mode ?? "auto",
  };
}

export interface BuildAgentConfigInput {
  agentKind: string;
  systemPrompt: string;
  runner?: AgentRunnerId;
  provider?: AgentConfig["provider"];
  maxIterations?: number;
  approvalMode?: AgentConfig["approvalMode"];
  /** Override delegable list; defaults to all delegable specialists for main assistant only. */
  enabledSpecialists?: AgentConfig["enabledSpecialists"];
}

export function buildAgentConfig(input: BuildAgentConfigInput): AgentConfig {
  const isMain = input.agentKind === MAIN_ASSISTANT_KIND;

  return {
    runner: input.runner ?? resolveDefaultRunner(),
    provider: input.provider ?? {
      kind: "openrouter",
      model: process.env.DEFAULT_MODEL_ID || "deepseek/deepseek-v4-pro",
    },
    systemPrompt: input.systemPrompt,
    tools: [],
    maxIterations: input.maxIterations ?? (isMain ? 12 : 25),
    approvalMode: input.approvalMode ?? "auto",
    enabledSpecialists: isMain
      ? (input.enabledSpecialists ?? listDelegableAgentKinds())
      : [],
  };
}

export interface SpawnAgentParams {
  agentKind: string;
  scopeId: string;
  systemPrompt: string;
  runner?: AgentRunnerId;
  provider?: AgentConfig["provider"];
  maxIterations?: number;
  approvalMode?: AgentConfig["approvalMode"];
  enabledSpecialists?: AgentConfig["enabledSpecialists"];
}

/** Resolve instance id + config for spawning a dedicated runner. */
export function prepareAgentSpawn(params: SpawnAgentParams): {
  instanceId: string;
  agentKind: string;
  config: AgentConfig;
} {
  const agentKind = canonicalAgentKind(params.agentKind);
  const instanceId =
    agentKind === MAIN_ASSISTANT_KIND
      ? buildMainAssistantInstanceId(params.scopeId)
      : buildSpecialistInstanceId(agentKind, params.scopeId);

  return {
    instanceId,
    agentKind,
    config: buildAgentConfig({
      agentKind,
      systemPrompt: params.systemPrompt,
      runner: params.runner,
      provider: params.provider,
      maxIterations: params.maxIterations,
      approvalMode: params.approvalMode,
      enabledSpecialists: params.enabledSpecialists,
    }),
  };
}
