"use client";

import type { DetectedRelationship } from "../types";

type RelationshipPanelProps = {
  relationships: DetectedRelationship[];
};

function confidenceBadge(
  confidence: "high" | "medium" | "low",
  t: (key: string) => string,
) {
  const styles = {
    high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  const labels = {
    high: "High",
    medium: "Medium",
    low: "Low",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[confidence]}`}>
      {labels[confidence]}
    </span>
  );
}

export function RelationshipPanel({ relationships }: RelationshipPanelProps) {
  if (relationships.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-3">
      <div>
        <h4 className="text-sm font-semibold">
          {"Detected Relationships"}
        </h4>
        <p className="text-xs text-muted-foreground">
          {"Potential JOIN keys detected between tables."}
        </p>
      </div>

      <div className="space-y-2">
        {relationships.slice(0, 8).map((rel, i) => (
          <div
            key={`${rel.tableA}-${rel.columnA}-${rel.tableB}-${rel.columnB}-${i}`}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-medium text-foreground truncate">
                {rel.tableA}.{rel.columnA}
              </span>
              <span className="text-muted-foreground shrink-0">&harr;</span>
              <span className="font-medium text-foreground truncate">
                {rel.tableB}.{rel.columnB}
              </span>
            </div>
            {confidenceBadge(rel.confidence)}
          </div>
        ))}
      </div>
    </div>
  );
}
