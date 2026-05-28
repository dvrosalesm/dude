import { BUILTIN_RUNNER_IDS, isBuiltinRunnerId, type BuiltinRunnerId } from "./builtins.js";
import type { AgentRunnerId, AgentRunnerManifest } from "./types.js";

export const BUILTIN_AGENT_RUNNERS: Record<
  BuiltinRunnerId,
  AgentRunnerManifest
> = {
  pi: {
    id: "pi",
    label: "Pi",
    description:
      "Mario Zechner's pi-coding-agent — skills, tools, and sandboxed bash.",
    availability: "ready",
    harnessKind: "hosted",
    installHint: "Bundled with Dude (npm dependency)",
    homepage: "https://github.com/badlogic/pi-mono",
  },
  codex: {
    id: "codex",
    label: "Codex",
    description:
      "OpenAI Codex app-server — native CLI loop with Dude specialist actions via internal dispatch API.",
    availability: "experimental",
    harnessKind: "native",
    installHint: "npm install -g @openai/codex  (requires `codex` on PATH)",
    homepage: "https://developers.openai.com/codex",
  },
  hermes: {
    id: "hermes",
    label: "Hermes",
    description:
      "OpenRouter ReAct loop with Dude specialist actions via internal dispatch API.",
    availability: "ready",
    harnessKind: "native",
    installHint: "Uses your configured LLM provider key (Settings → API & Models).",
    homepage: "https://hermes-agent.nousresearch.com",
  },
  cursor: {
    id: "cursor",
    label: "Cursor SDK",
    description:
      "Cursor programmatic agent API with Dude specialist actions via internal dispatch API.",
    availability: "experimental",
    harnessKind: "native",
    installHint:
      "Set your Cursor API key in Settings → AI Runners (cursor.com/dashboard/integrations).",
    homepage: "https://cursor.com/docs/sdk/typescript",
  },
};

export function getBuiltinRunnerManifest(
  id: AgentRunnerId,
): AgentRunnerManifest | undefined {
  if (isBuiltinRunnerId(id)) {
    return BUILTIN_AGENT_RUNNERS[id];
  }
  return undefined;
}

export function listBuiltinRunners(): AgentRunnerManifest[] {
  return BUILTIN_RUNNER_IDS.map((id) => BUILTIN_AGENT_RUNNERS[id]);
}
