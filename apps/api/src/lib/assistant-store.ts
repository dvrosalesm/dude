/**
 * Assistant config store — local SQLite only.
 */

import {
  getAssistantConfig as readConfig,
  putAssistantConfig as writeConfig,
  type LocalAssistantConfig,
} from "./local-sqlite.js";

export type ApprovalMode = "auto" | "draft" | "per-step";

export interface AssistantConfig {
  system_prompt: string;
  enabled: boolean;
  enabled_subagents: string[];
  max_iterations: number;
  approval_mode: ApprovalMode;
  model: string | null;
  provider: string | null;
  agent_runner: string | null;
  harness_credentials: Record<string, unknown> | null;
  harness_runner_settings: Record<string, unknown> | null;
  updated_at: string;
}

export interface AssistantConfigPatch {
  system_prompt?: string;
  enabled?: boolean;
  enabled_subagents?: string[];
  max_iterations?: number;
  approval_mode?: ApprovalMode;
  model?: string | null;
  provider?: string | null;
  agent_runner?: string | null;
  harness_credentials?: Record<string, unknown> | null;
  harness_runner_settings?: Record<string, unknown> | null;
}

function mapConfig(row: LocalAssistantConfig): AssistantConfig {
  return {
    system_prompt: row.system_prompt,
    enabled: row.enabled,
    enabled_subagents: row.enabled_subagents,
    max_iterations: row.max_iterations,
    approval_mode: row.approval_mode,
    model: row.model,
    provider: row.provider,
    agent_runner: row.agent_runner,
    harness_credentials: row.harness_credentials,
    harness_runner_settings: row.harness_runner_settings,
    updated_at: row.updated_at,
  };
}

export async function getAssistantConfig(): Promise<AssistantConfig> {
  return mapConfig(readConfig());
}

export async function putAssistantConfig(
  patch: AssistantConfigPatch,
): Promise<AssistantConfig> {
  return mapConfig(writeConfig(patch));
}
