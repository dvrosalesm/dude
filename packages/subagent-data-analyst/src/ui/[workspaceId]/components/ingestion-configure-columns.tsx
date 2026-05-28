"use client";

import { Input } from "@dude/ui/components/input";
import type { ColumnStat, IngestIssue } from "../utils";
import { IssueFlag, typeBadgeClass } from "./ingestion-configure-widgets";

export function ColumnList({
  stats,
  mappings,
  onMappingChange,
  issuesByHeader,
}: {
  stats: ColumnStat[];
  mappings: Record<string, string>;
  onMappingChange: (header: string, value: string) => void;
  issuesByHeader: Map<string, IngestIssue[]>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
      <div className="grid grid-cols-[minmax(140px,1fr)_minmax(180px,1.2fr)_110px_70px_minmax(160px,1.2fr)_240px] gap-3 border-b border-border/50 bg-card px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <div>{"Source"}</div>
        <div>{"Rename to"}</div>
        <div>{"Type"}</div>
        <div>{"Nulls"}</div>
        <div>{"Sample"}</div>
        <div />
      </div>
      <div className="divide-y divide-border/50">
        {stats.map((stat) => {
          const nullPct =
            stat.totalRows > 0
              ? Math.round((stat.nullCount / stat.totalRows) * 100)
              : 0;
          const issues = issuesByHeader.get(stat.header) ?? [];
          const flagged = issues.length > 0;
          return (
            <div
              key={stat.header}
              className="grid grid-cols-[minmax(140px,1fr)_minmax(180px,1.2fr)_110px_70px_minmax(160px,1.2fr)_240px] items-center gap-3 px-4 py-2 text-sm"
            >
              <div className="truncate font-mono text-xs text-muted-foreground">
                {stat.header}
              </div>
              <Input
                value={mappings[stat.header] ?? ""}
                onChange={(event) =>
                  onMappingChange(stat.header, event.target.value)
                }
                className="h-8 text-xs bg-card border border-border/50 shadow-sm rounded-lg"
              />
              <span
                className={`inline-flex w-fit items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${typeBadgeClass(
                  stat.inferredType.type,
                )}`}
              >
                {stat.inferredType.type}
              </span>
              <span
                className={`text-xs ${
                  flagged && issues.some((issue) => issue.kind === "high_nulls")
                    ? "text-amber-600"
                    : "text-muted-foreground"
                }`}
              >
                {nullPct}%
              </span>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {stat.sampleValues.length === 0 ? (
                  <span className="italic">—</span>
                ) : (
                  stat.sampleValues.map((value, idx) => (
                    <span
                      key={`${stat.header}-sample-${idx}`}
                      className="truncate"
                    >
                      {value}
                    </span>
                  ))
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {issues.map((issue, idx) => (
                  <IssueFlag
                    key={`${stat.header}-issue-${idx}`}
                    issue={issue}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
