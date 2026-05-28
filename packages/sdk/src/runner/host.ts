import type { AgentRunnerManifest } from "./types.js";

export interface CustomRunnerRegistration {
  manifest: AgentRunnerManifest;
  /** Absolute or repo-relative path to the adapter `server.ts` entry. */
  serverEntry: string;
  checkAvailability?: () => boolean;
}

export interface RunnerHostConfig {
  runners?: CustomRunnerRegistration[];
}

export function defineRunnerHost(config: RunnerHostConfig): RunnerHostConfig {
  return config;
}
