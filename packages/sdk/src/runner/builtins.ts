/**
 * Canonical registry of built-in agent runners.
 * Add a runner here once — manifests, client registry, and server spawn map derive from this list.
 */

export const BUILTIN_RUNNER_IDS = [
  "pi",
  "codex",
  "hermes",
  "cursor",
] as const;

export type BuiltinRunnerId = (typeof BUILTIN_RUNNER_IDS)[number];

const BUILTIN_RUNNER_ID_SET = new Set<string>(BUILTIN_RUNNER_IDS);

export function isBuiltinRunnerId(id: string): id is BuiltinRunnerId {
  return BUILTIN_RUNNER_ID_SET.has(id);
}

export function listBuiltinRunnerIds(): readonly BuiltinRunnerId[] {
  return BUILTIN_RUNNER_IDS;
}
