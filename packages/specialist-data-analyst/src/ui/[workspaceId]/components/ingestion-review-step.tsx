"use client";

import type { ClipboardEvent, DragEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Server,
  Upload,
  Wand2,
} from "lucide-react";
import { Badge } from "@dude/ui/components/badge";
import { Button } from "@dude/ui/components/button";
import { Input } from "@dude/ui/components/input";
import { Progress } from "@dude/ui/components/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dude/ui/components/select";
import { Switch } from "@dude/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dude/ui/components/table";
import {
  ALL_STEPS,
  type IngestStep,
  type UseDataIngestionReturn,
} from "../hooks/use-data-ingestion";
import type { ColumnStat, IngestIssue, IngestSourceKind } from "../utils";

import { stepIndex, formatBytes, sourceExtension } from "./ingestion-shared";

export function ReviewStep({ ingestion }: { ingestion: UseDataIngestionReturn }) {
  const file = ingestion.ingestFile;
  const parsed = ingestion.parsedFile;
  if (!file || !parsed) return null;

  const flaggedHeaders = new Set<string>();
  for (const issue of ingestion.issues) {
    flaggedHeaders.add(issue.header);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">
          {"Review & import"}
        </h4>
        <p className="text-xs text-muted-foreground">
          {"Last check before we write to your workspace."}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="space-y-3 rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {"Summary"}
          </p>
          <SummaryRow
            label={"Source"}
            value={file.name}
          />
          <SummaryRow
            label={"Destination"}
            value={`workspace.${ingestion.tableName || "—"}`}
            mono
          />
          <SummaryRow
            label={"Rows"}
            value={parsed.rows.length.toLocaleString()}
          />
          <SummaryRow
            label={"Columns"}
            value={parsed.headers.length + " (" + flaggedHeaders.size + " flagged)"}
          />
          <SummaryRow
            label={"Mode"}
            value={
              ingestion.appendToExisting
                ? "Append to existing"
                : "Replace if exists"
            }
          />
        </div>
        <div className="space-y-3 rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {"Issues"}
          </p>
          {ingestion.issues.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {"No issues detected."}
            </p>
          ) : (
            <ul className="space-y-2">
              {ingestion.issues.map((issue, idx) => (
                <li
                  key={`${issue.header}-${idx}`}
                  className="flex items-start gap-2 text-xs"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <div>
                    <p className="font-mono text-[11px] font-medium">
                      {issue.header}
                    </p>
                    <p className="text-muted-foreground">
                      <IssueLabel issue={issue} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function IssueLabel({ issue }: { issue: IngestIssue }) {
  if (issue.kind === "high_nulls") {
    return (
      <>
        {issue.percent + "% nulls"}
      </>
    );
  }
  if (issue.kind === "id_as_string") {
    return (
      <>
        {issue.digits + "-digit ID; storing as string"}
      </>
    );
  }
  return (
    <>
      {"duplicate of '" + issue.otherHeader + "' at " + issue.match + "% match"}
    </>
  );
}

export function SummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-border/40 pb-2 last:border-none last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-xs ${mono ? "font-mono" : "font-medium"} text-foreground`}
      >
        {value}
      </span>
    </div>
  );
}

