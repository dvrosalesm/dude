import type { ExecutionTrace } from "../types";

const EDIT_TOOL_NAMES = new Set(["edit_document", "edit_presentation"]);

function normalizeToolArguments(args: unknown): Record<string, unknown> {
  if (args && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  if (typeof args === "string") {
    try {
      const parsed = JSON.parse(args) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore malformed JSON */
    }
  }
  return {};
}

function extractEditsFromArguments(args: Record<string, unknown>): unknown[] {
  if (Array.isArray(args.edits)) return args.edits;
  const payload = args.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const nested = (payload as Record<string, unknown>).edits;
    if (Array.isArray(nested)) return nested;
  }
  return [];
}

/** Pull edit payloads from live execution traces (edit_document / edit_presentation). */
export function extractPendingEditsFromTraces(
  traces: ExecutionTrace[],
): unknown[] {
  const edits: unknown[] = [];

  for (const trace of traces) {
    for (const execution of trace.toolExecutions ?? []) {
      if (!EDIT_TOOL_NAMES.has(execution.tool)) continue;
      edits.push(...extractEditsFromArguments(normalizeToolArguments(execution.arguments)));
    }
  }

  return edits;
}
