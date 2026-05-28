"use client";

import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import { Button } from "@dude/ui/components/button";
import { Progress } from "@dude/ui/components/progress";
import {
  Check,
  Database,
  BarChart3,
  Table2,
  Shield,
  Link2,
  Columns3,
  MessageCircle,
} from "lucide-react";
import type {
  QualityScanResult,
  ColumnStats,
  DetectedRelationship,
  WorkspaceSchema,
} from "../types";

type PostImportScreenProps = {
  phase: "importing" | "processing" | "complete";
  // Import phase
  ingestProgress?: number | null;
  ingestProgressLabel?: string;
  // Processing phase
  postImportProgress: number;
  postImportTotal: number;
  qualityScan: QualityScanResult | null;
  qualityScanLoading: boolean;
  columnStats: Record<string, ColumnStats[]> | null;
  columnStatsLoading: boolean;
  // Summary
  schema: WorkspaceSchema | null;
  detectedRelationships: DetectedRelationship[];
  reportsCount: number;
  // Actions
  onChatWithData: () => void;
};

export function PostImportScreen({
  phase,
  ingestProgress,
  ingestProgressLabel,
  postImportProgress,
  postImportTotal,
  qualityScan,
  qualityScanLoading,
  columnStats,
  columnStatsLoading,
  schema,
  detectedRelationships,
  reportsCount,
  onChatWithData,
}: PostImportScreenProps) {
  // ── IMPORTING ──────────────────────────────────────────────
  if (phase === "importing") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center">
          <BrailleSpinner className="text-4xl" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">
              {"Importing your data"}
            </h2>
            {ingestProgressLabel && (
              <p className="text-sm text-muted-foreground">
                {ingestProgressLabel}
              </p>
            )}
          </div>
          {ingestProgress != null && (
            <Progress value={ingestProgress} className="h-1.5 w-64" />
          )}
        </div>
      </div>
    );
  }

  // ── PROCESSING ─────────────────────────────────────────────
  if (phase === "processing") {
    const steps: Array<{ label: string; done: boolean }> = [
      {
        label: "Analyzing data structure",
        done: postImportProgress >= 1,
      },
      {
        label: "Scanning data quality",
        done: !qualityScanLoading && qualityScan !== null,
      },
      {
        label: "Computing column statistics",
        done: !columnStatsLoading && columnStats !== null,
      },
      {
        label: "Generating dataset summary",
        done: postImportProgress >= postImportTotal,
      },
    ];

    const currentStep = steps.find((s) => !s.done);

    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-8 max-w-md text-center">
          <BrailleSpinner className="text-4xl text-[#E7C59A]" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">
              {"Setting up your workspace"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {currentStep?.label ??
                "Finishing up..."}
            </p>
          </div>

          <div className="w-full space-y-1.5 text-left">
            {steps.map((step, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                  step.done
                    ? "text-muted-foreground"
                    : step === currentStep
                      ? "bg-muted/30 text-foreground font-medium"
                      : "text-muted-foreground/40"
                }`}
              >
                {step.done ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : step === currentStep ? (
                  <BrailleSpinner className="text-sm shrink-0 text-[#E7C59A]" />
                ) : (
                  <div className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground/20" />
                )}
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── COMPLETE ───────────────────────────────────────────────
  const tableNames = schema ? Object.keys(schema.tables) : [];
  const totalTables = tableNames.length;
  const totalRows = schema
    ? tableNames.reduce((sum, n) => sum + schema.tables[n].rowCount, 0)
    : 0;
  const totalColumns = schema
    ? tableNames.reduce((sum, n) => sum + schema.tables[n].columns.length, 0)
    : 0;
  const qualityScore = qualityScan?.overallScore ?? null;
  const qualityTone =
    qualityScore === null
      ? "text-muted-foreground"
      : qualityScore >= 90
        ? "text-emerald-600"
        : qualityScore >= 70
          ? "text-amber-600"
          : "text-red-600";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-10">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Check className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {"Your workspace is ready"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {"We've analyzed your data and generated initial reports to get you started."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="space-y-3 rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {"Summary"}
          </p>
          <MetricRow
            icon={Table2}
            label={"Tables"}
            value={totalTables.toLocaleString()}
          />
          <MetricRow
            icon={Database}
            label={"Rows"}
            value={totalRows.toLocaleString()}
          />
          <MetricRow
            icon={Columns3}
            label={"Columns"}
            value={totalColumns.toLocaleString()}
          />
          <MetricRow
            icon={Shield}
            label={"Quality"}
            value={qualityScore !== null ? `${qualityScore}/100` : "—"}
            valueClassName={qualityTone}
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {"Analysis"}
          </p>
          <MetricRow
            icon={Link2}
            label={"Relationships"}
            value={detectedRelationships.length.toLocaleString()}
          />
          <MetricRow
            icon={BarChart3}
            label={"Reports"}
            value={reportsCount.toLocaleString()}
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 pt-2">
        <button
          type="button"
          onClick={onChatWithData}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all active:translate-y-[1px] active:shadow-none disabled:pointer-events-none disabled:opacity-50"
          style={{
            background: "linear-gradient(180deg, #E7C59A, #E7C59A)",
            boxShadow: "0 2px 0 0 #E7C59A, 0 4px 10px rgba(231,197,154,0.25)",
          }}
        >
          <MessageCircle className="h-4 w-4" />
          {"Chat with your data"}
        </button>
      </div>
    </div>
  );
}

function MetricRow({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-border/40 pb-2 last:border-none last:pb-0">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className={`text-sm font-medium tabular-nums ${valueClassName ?? "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
