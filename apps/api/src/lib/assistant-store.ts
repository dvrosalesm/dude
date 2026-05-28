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
  enabled_specialists: string[];
  max_iterations: number;
  approval_mode: ApprovalMode;
  model: string | null;
  provider: string | null;
  updated_at: string;
}

export interface AssistantConfigPatch {
  system_prompt?: string;
  enabled?: boolean;
  enabled_specialists?: string[];
  max_iterations?: number;
  approval_mode?: ApprovalMode;
  model?: string | null;
  provider?: string | null;
}

function mapConfig(row: LocalAssistantConfig): AssistantConfig {
  return {
    system_prompt: row.system_prompt,
    enabled: row.enabled,
    enabled_specialists: row.enabled_specialists,
    max_iterations: row.max_iterations,
    approval_mode: row.approval_mode,
    model: row.model,
    provider: row.provider,
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
