import type { ExecutionTrace } from "../types";
import { friendlyToolLabel } from "@dude/gateway-shared/tool-labels";

export function cleanTraceStep(step: string): string {
  if (!step) return "";
  // Hide raw JSON-arg noise from streaming traces
  if (step.includes('{"') || step.includes('\\"')) return "";
  return step;
}

/** Derive a short, human-friendly label for what the agent is currently doing. */
export function liveStepLabel(traces: ExecutionTrace[] | undefined): string {
  if (!traces || traces.length === 0) return "";
  const latest = traces[traces.length - 1];

  // Prefer the most recent tool name (what's running right now) over a stale
  // textual step — tool execution is the clearest signal of current activity.
  const execs = Array.isArray(latest.toolExecutions) ? latest.toolExecutions : [];
  for (let i = execs.length - 1; i >= 0; i--) {
    const exec = execs[i] as { tool?: unknown; name?: unknown; arguments?: unknown; result?: unknown };
    const toolName = typeof exec?.tool === "string"
      ? exec.tool
      : typeof exec?.name === "string"
        ? exec.name
        : "";
    if (toolName) {
      const args = (exec.arguments && typeof exec.arguments === "object")
        ? (exec.arguments as Record<string, unknown>)
        : undefined;
      const { active, past } = friendlyToolLabel(toolName, args);
      return exec.result == null ? active : past;
    }
  }

  const steps = Array.isArray(latest.steps) ? latest.steps : [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const cleaned = cleanTraceStep(steps[i]);
    if (cleaned) return cleaned;
  }

  return "";
}
