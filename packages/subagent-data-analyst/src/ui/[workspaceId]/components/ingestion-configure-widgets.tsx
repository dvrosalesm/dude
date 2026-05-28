"use client";

import { AlertTriangle } from "lucide-react";
import { Switch } from "@dude/ui/components/switch";
import type { UseDataIngestionReturn } from "../hooks/use-data-ingestion";
import type { ColumnStat, IngestIssue } from "../utils";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export function typeBadgeClass(type: string) {
  switch (type) {
    case "number":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "date":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "boolean":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function ColumnHeaderCell({
  header,
  rename,
  stat,
}: {
  header: string;
  rename: string;
  stat?: ColumnStat;
}) {
  const typeLabel = stat?.inferredType.type ?? "text";
  return (
    <div className="space-y-1 py-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{rename || header}</span>
        <span
          className={`inline-flex items-center rounded-md border px-1.5 text-[10px] font-medium ${typeBadgeClass(
            typeLabel,
          )}`}
        >
          {typeLabel}
        </span>
      </div>
      {stat && stat.totalRows > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {Math.round((stat.nullCount / Math.max(stat.totalRows, 1)) * 100)}%
          null · {stat.uniqueCount.toLocaleString()} unique
        </p>
      )}
    </div>
  );
}

export function IssueFlag({ issue }: { issue: IngestIssue }) {
  const label =
    issue.kind === "high_nulls"
      ? `${issue.percent}% nulls`
      : issue.kind === "id_as_string"
        ? `${issue.digits}-digit ID; storing as string`
        : `duplicate of '${issue.otherHeader}' at ${issue.match}% match`;

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}

export function AppendToggle({
  ingestion,
}: {
  ingestion: UseDataIngestionReturn;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Append to existing table</p>
        <p className="text-xs text-muted-foreground">
          {`If a table named ${ingestion.tableName || "—"} already exists, add these rows to it.`}
        </p>
      </div>
      <Switch
        checked={ingestion.appendToExisting}
        onCheckedChange={ingestion.handleAppendToExistingChange}
      />
    </div>
  );
}
