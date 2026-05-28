"use client";

import { memo } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import type { DesignReviewScore } from "@dude/subagent-design-branding/lib/types";
import { CanvasNodeRefHandle } from "./canvas-ref-handle";
import { DeleteNodeButton } from "./delete-node-button";

interface ReviewData {
  targetUrl?: string;
  scores?: DesignReviewScore[];
  summary?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  brandFit: "Brand fit",
  hierarchy: "Hierarchy",
  contrast: "Contrast",
  consistency: "Consistency",
  craft: "Craft",
};

function scoreColor(score: number): string {
  if (score >= 8) return "#10b981";
  if (score >= 5) return "#f59e0b";
  return "#ef4444";
}

function DesignReviewNodeInner({ id, data, selected }: NodeProps) {
  const { targetUrl = "", scores = [], summary = "" } = (data || {}) as ReviewData;

  const refContent = [
    "[Canvas reference — design review]",
    targetUrl ? `Target: ${targetUrl}` : null,
    scores.length
      ? `Scores:\n${scores
          .map(
            (s) =>
              `- ${CATEGORY_LABELS[s.category] || s.category}: ${s.score.toFixed(1)}/10${s.notes ? ` — ${s.notes}` : ""}`,
          )
          .join("\n")}`
      : null,
    summary ? `\nSummary:\n${summary}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="relative h-full w-full group/review-node">
      <NodeResizer
        isVisible={selected}
        minWidth={280}
        minHeight={220}
        lineClassName="!border-foreground/20"
        handleClassName="!bg-foreground/40 !border-background"
      />
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="absolute inset-0 rounded-xl bg-card shadow-sm border border-border/40 px-4 py-3 overflow-hidden flex flex-col">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        Design review
      </p>
      {targetUrl && (
        <a
          href={targetUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-600 truncate hover:underline"
        >
          {targetUrl}
        </a>
      )}
      <div className="mt-2 flex-1 overflow-y-auto space-y-1.5">
        {scores.map((s, idx) => (
          <div key={`${s.category}-${idx}`} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground/80">
                {CATEGORY_LABELS[s.category] || s.category}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {s.score.toFixed(1)} / 10
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.max(0, Math.min(10, s.score)) * 10}%`,
                  background: scoreColor(s.score),
                }}
              />
            </div>
            {s.notes && (
              <p className="text-[11px] text-muted-foreground line-clamp-2">
                {s.notes}
              </p>
            )}
          </div>
        ))}
        {summary && (
          <p className="text-xs text-foreground/80 mt-2 whitespace-pre-wrap">
            {summary}
          </p>
        )}
      </div>
      </div>
      <div
        className={`absolute left-full top-0 ml-2 z-10 flex flex-col items-start gap-1.5 transition-opacity ${
          selected
            ? "opacity-100"
            : "opacity-0 group-hover/review-node:opacity-100"
        }`}
      >
        <CanvasNodeRefHandle
          id={id}
          type="designReview"
          name={targetUrl ? `Review · ${targetUrl}` : "Design review"}
          content={refContent}
          positionClass=""
          variant="pill"
        />
        <DeleteNodeButton id={id} />
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

export const DesignReviewNode = memo(DesignReviewNodeInner);
