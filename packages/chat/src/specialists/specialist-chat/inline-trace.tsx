"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Code,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import { cn, chatPillClassName } from "@dude/ui/design-system";
import { friendlyToolLabel } from "@dude/gateway-shared/tool-labels";
import type { ExecutionTrace } from "../types";
import { isSpecialistCall, SPECIALIST_META } from "../specialist-meta";
import { DEFAULT_TOOL_ICONS, defaultArgPreview } from "./helpers";
import { liveTraceLabel, normalizeTraceSteps } from "./trace-steps";

export function InlineTrace({
  traces,
  live,
  progressMessages,
  toolIcons,
  argPreview,
}: {
  traces: ExecutionTrace[];
  live?: boolean;
  progressMessages?: string[];
  toolIcons?: Record<string, LucideIcon>;
  argPreview?: (tool: string, args: Record<string, unknown>) => string;
}) {
  const [expanded, setExpanded] = useState(live);
  const icons = { ...DEFAULT_TOOL_ICONS, ...toolIcons };
  const getPreview = argPreview || defaultArgPreview;

  if (!traces.length) return null;

  // Only show non-specialist tools here — specialist calls render separately
  const regularExecs = traces.flatMap((t) =>
    (t.toolExecutions ?? []).filter((e) => !isSpecialistCall(e.tool)),
  );
  const displaySteps = traces.flatMap((trace) =>
    normalizeTraceSteps(trace.steps ?? []),
  );
  const totalSteps = displaySteps.length;
  const totalDuration = traces.reduce((sum, t) => sum + t.durationMs, 0);

  // If there's nothing to show (only specialist calls), skip
  if (regularExecs.length === 0 && totalSteps === 0) return null;

  const latestProgress = progressMessages?.[progressMessages.length - 1]?.trim();
  const liveLabel = live
    ? latestProgress || liveTraceLabel(traces)
    : "Done";

  const summaryParts = [
    regularExecs.length > 0 && `${regularExecs.length} tool${regularExecs.length > 1 ? "s" : ""}`,
    totalSteps > 0 && `${totalSteps} step${totalSteps > 1 ? "s" : ""}`,
    totalDuration > 0 && `${(totalDuration / 1000).toFixed(1)}s`,
  ].filter(Boolean);

  return (
    <div className="max-w-[80%] text-left">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors text-left"
      >
        {live ? (
          <BrailleSpinner className="text-[10px] text-primary" />
        ) : (
          <Zap className="h-3 w-3 text-muted-foreground/60" />
        )}
        <span className={live ? "font-medium" : ""}>
          {live ? liveLabel : summaryParts.join(" · ") || "Done"}
        </span>
        <ChevronDown className={`h-3 w-3 opacity-50 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="mt-2 space-y-3 pl-4 text-left">
          {traces.map((trace) => (
            <div key={trace.id} className="space-y-2.5">
              {normalizeTraceSteps(trace.steps ?? []).map((step, i) => {
                const isErrorStep = step.startsWith("Error:");
                return (
                <div
                  key={`${trace.id}-step-${i}`}
                  className={cn(
                    "text-[11px]",
                    isErrorStep
                      ? "text-destructive/90"
                      : "text-muted-foreground/70",
                  )}
                >
                  {step}
                </div>
                );
              })}

              {(trace.toolExecutions ?? [])
                .filter((e) => !isSpecialistCall(e.tool))
                .map((exec, i) => {
                  const ToolIcon = icons[exec.tool] || Code;
                  const hasError = Boolean(exec.result && typeof exec.result === "object" && "error" in (exec.result as Record<string, unknown>));
                  const preview = getPreview(exec.tool, exec.arguments ?? {});
                  const isPending = exec.result == null;
                  const { active, past } = friendlyToolLabel(exec.tool, exec.arguments);
                  const friendlyLabel = isPending ? active : past;
                  return (
                    <div key={`${trace.id}-tool-${i}`} className="space-y-1">
                      <div className="flex items-center gap-2 text-[11px]">
                        <ToolIcon className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                        <span className="font-medium text-foreground/80">{friendlyLabel}</span>
                        {hasError && <span className="text-[9px] text-destructive">failed</span>}
                      </div>
                      {preview && (
                        <pre className="whitespace-pre-wrap break-all text-[10px] text-muted-foreground/60 max-h-20 overflow-y-auto">{preview}</pre>
                      )}
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
