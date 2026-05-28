import { getAgentRunnerManifest } from "./registry-store.js";

/** Tools that spawn a hosted LLM on the API (Pi-only). */
export const HOSTED_LLM_TOOL_NAMES = new Set(["generate_slide"]);

/**
 * Runners where the harness LLM generates content; hosted LLM tools must not run.
 * Defaults to native for unknown custom runners (conservative).
 */
export function isNativeRunner(runner?: string | null): boolean {
  const id = runner?.trim();
  if (!id) return false;

  const manifest = getAgentRunnerManifest(id);
  if (manifest) {
    return manifest.harnessKind === "native";
  }

  return false;
}

export function filterToolsForRunner<T extends { name: string }>(
  tools: T[],
  runner?: string | null,
): T[] {
  if (!isNativeRunner(runner)) return tools;
  return tools.filter((tool) => !HOSTED_LLM_TOOL_NAMES.has(tool.name));
}
