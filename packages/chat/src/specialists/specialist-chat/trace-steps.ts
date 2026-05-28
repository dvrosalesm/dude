import { friendlyToolLabel } from "@dude/gateway-shared/tool-labels";
import type { ExecutionTrace } from "../types";

const GENERIC_STEPS = new Set([
  "Thinking…",
  "Thinking...",
  "Composing the response…",
  "Still working…",
]);

export function normalizeTraceSteps(steps: string[]): string[] {
  const deduped: string[] = [];
  for (const step of steps) {
    const trimmed = step.trim();
    if (!trimmed) continue;
    if (deduped[deduped.length - 1] === trimmed) continue;
    deduped.push(trimmed);
  }

  const meaningful = deduped.filter((step) => !GENERIC_STEPS.has(step));
  return meaningful.length > 0 ? meaningful : deduped.slice(-1);
}

export function liveTraceLabel(traces: ExecutionTrace[]): string {
  for (const trace of [...traces].reverse()) {
    for (const execution of [...(trace.toolExecutions ?? [])].reverse()) {
      if (execution.result == null) {
        return friendlyToolLabel(execution.tool, execution.arguments ?? {}).active;
      }
    }
  }

  for (const trace of [...traces].reverse()) {
    const steps = normalizeTraceSteps(trace.steps ?? []);
    for (let i = steps.length - 1; i >= 0; i -= 1) {
      const step = steps[i];
      if (step && !GENERIC_STEPS.has(step)) return step;
    }
  }

  return "Working…";
}
