"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  ChevronDown,
  Download,
  Pin,
  PinOff,
  Settings,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dude/ui/components/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@dude/ui/components/alert-dialog";
import { Button } from "@dude/ui/components/button";
import { Input } from "@dude/ui/components/input";
import { Renderer, JSONUIProvider } from "@json-render/react";
import { ChartColorsProvider } from "@dude/data-analyst-core/render/chart-colors-context";
import { QueryProvider } from "@dude/data-analyst-core/render/query-context";
import { registry } from "@dude/data-analyst-core/render/registry";
import { createWorkspaceSqlQuery } from "../workspace-sql-query";
import type { ReportItem } from "../types";

type ReportsSectionProps = {
  title: string;
  description: string;
  emptyLabel: string;
  reports: ReportItem[];
  chartColors: string[];
  onChartColorsChange: (colors: string[]) => void;
  query: string;
  onQueryChange: (value: string) => void;
  onDeleteReport: (id: string) => void;
  onResizeReport: (id: string, colSpan: number, rowSpan: number) => void;
  onPinReport: (id: string, pinned: boolean) => void;
  specialistId: "data-analyst";
  workspaceId: string;
};

function formatTimestamp(timestamp: string) {
  if (!timestamp) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(new Date(timestamp));
  } catch {
    return timestamp;
  }
}

function RenderSpecCard({
  renderSpec,
  chartColors,
  specialistId,
  workspaceId,
}: {
  renderSpec: Record<string, unknown>;
  chartColors: string[];
  specialistId: "data-analyst";
  workspaceId: string;
}) {
  const runQuery = useCallback(
    createWorkspaceSqlQuery(specialistId, workspaceId),
    [specialistId, workspaceId],
  );

  return (
    <QueryProvider runQuery={runQuery}>
      <ChartColorsProvider colors={chartColors}>
        <JSONUIProvider registry={registry}>
          <Renderer spec={renderSpec as StringKeyRecord} registry={registry} />
        </JSONUIProvider>
      </ChartColorsProvider>
    </QueryProvider>
  );
}

export function ReportsSection({
  title,
  description,
  emptyLabel,
  reports,
  chartColors,
  onChartColorsChange,
  query,
  onQueryChange,
  onDeleteReport,
  onResizeReport,
  onPinReport,
  specialistId,
  workspaceId,
}: ReportsSectionProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [draftColors, setDraftColors] = useState<string[]>(chartColors);
  const [confirmingReport, setConfirmingReport] = useState<ReportItem | null>(null);
  const [dragState, setDragState] = useState<{
    reportId: string;
    startX: number;
    startY: number;
    startColSpan: number;
    startRowSpan: number;
    colUnit: number;
    rowUnit: number;
  } | null>(null);

  useEffect(() => {
    if (configOpen) {
      setDraftColors(chartColors);
    }
  }, [chartColors, configOpen]);

  const orderedReports = useMemo(() => {
    return [...reports].sort((a, b) => {
      const pinnedDelta = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
      if (pinnedDelta !== 0) return pinnedDelta;
      const aPos = typeof a.position === "number" ? a.position : reports.indexOf(a);
      const bPos = typeof b.position === "number" ? b.position : reports.indexOf(b);
      return aPos - bPos;
    });
  }, [reports]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredReports = normalizedQuery
    ? orderedReports.filter((report) => {
      const haystack = [report.title, report.summary, report.prompt]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    : orderedReports;

  const reportById = useMemo(() => {
    return new Map(reports.map((report) => [report.id, report]));
  }, [reports]);

  function getReportSpan(report: ReportItem) {
    const colSpan = report.colSpan ?? (report.size === "s" ? 2 : 4);
    const rowSpan = report.rowSpan ?? (report.size === "l" ? 3 : report.size === "s" ? 1 : 2);
    return { colSpan, rowSpan };
  }

  async function exportReportAsImage(reportId: string) {
    const card = gridRef.current?.querySelector(`[data-report-id="${reportId}"]`) as HTMLElement | null;
    if (!card) return;
    const { toPng } = await import("html-to-image");
    try {
      const dataUrl = await toPng(card, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        filter: (node) => {
          if (node instanceof HTMLElement) return !node.classList.contains("print-hide");
          return true;
        },
      });
      const report = reportById.get(reportId);
      const slug = (report?.title ?? "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      const link = document.createElement("a");
      link.download = `${slug}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("[ReportsSection] export failed:", err);
    }
  }

  function startResize(reportId: string, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const grid = gridRef.current;
    const report = reportById.get(reportId);
    if (!grid || !report) return;
    const rect = grid.getBoundingClientRect();
    const style = getComputedStyle(grid);
    const colGap = Number.parseFloat(style.columnGap || "0") || 0;
    const rowGap = Number.parseFloat(style.rowGap || "0") || 0;
    const autoRows = Number.parseFloat(style.gridAutoRows || "0") || 224;
    const columns = 4;
    const colWidth = columns > 1 ? (rect.width - colGap * (columns - 1)) / columns : rect.width;
    const colUnit = colWidth + colGap;
    const rowUnit = autoRows + rowGap;
    const { colSpan, rowSpan } = getReportSpan(report);
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({ reportId, startX: event.clientX, startY: event.clientY, startColSpan: colSpan, startRowSpan: rowSpan, colUnit, rowUnit });
  }

  useEffect(() => {
    if (!dragState) return;
    const current = dragState;
    function handleMove(event: PointerEvent) {
      const deltaX = event.clientX - current.startX;
      const deltaY = event.clientY - current.startY;
      const nextColSpan = Math.min(4, Math.max(1, current.startColSpan + Math.round(deltaX / current.colUnit)));
      const nextRowSpan = Math.min(4, Math.max(1, current.startRowSpan + Math.round(deltaY / current.rowUnit)));
      onResizeReport(current.reportId, nextColSpan, nextRowSpan);
    }
    function handleUp() {
      setDragState(null);
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragState, onResizeReport]);

  return (
    <section className="relative min-h-[70vh]" data-report-export>
      <style>
        {`
@media print {
          html, body { height: auto !important; overflow: visible !important; }
          body * { visibility: hidden !important; }
          [data-report-export], [data-report-export] * { visibility: visible !important; }
          [data-report-export] { position: absolute; left: 0; top: 0; width: 100%; background: white; padding: 16px; overflow: visible !important; }
          [data-report-export] .print-hide { display: none !important; }
          [data-report-export] .print-only { display: flex !important; }
          [data-report-export] [data-report-grid] { display: block !important; grid-template-columns: none !important; grid-auto-rows: auto !important; }
          [data-report-export] [data-report-card] { break-inside: avoid; page-break-inside: avoid; grid-column: unset !important; grid-row: unset !important; height: auto !important; min-height: 20rem; margin-bottom: 1rem; overflow: visible !important; }
        }
        [data-report-export] .print-only { display: none; }
        `}
      </style>
      <div className="print-only items-center gap-3 border-b border-border/50 pb-3">
        <img src="/assets/logo.png" alt="Dude Logo" className="h-8 w-8 rounded-lg" />
        <div className="text-lg font-semibold">Dude</div>
      </div>
      <div className="flex flex-col gap-1 mt-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mt-4 print-hide">
        <div className="flex-1 max-w-xs">
          <Input
            placeholder={"Search reports..."}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="h-8 text-xs bg-card"
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setConfigOpen(true)} className="h-8 text-xs">
          <Settings className="mr-1.5 h-3.5 w-3.5" />
          Colors
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="h-8 text-xs">
          {"Export PDF"}
        </Button>
      </div>

      {!filteredReports.length && (
        <div className="mt-6 rounded-2xl bg-card/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      )}

      {filteredReports.length > 0 && (
        <div ref={gridRef} data-report-grid className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4 auto-rows-[14rem]">
          {filteredReports.map((report) => {
            const { colSpan, rowSpan } = getReportSpan(report);
            const resolvedColSpan = Math.min(4, Math.max(1, colSpan));
            const resolvedRowSpan = Math.min(4, Math.max(1, rowSpan));
            return (
              <div
                key={report.id}
                data-report-card
                data-report-id={report.id}
                className="group relative rounded-2xl bg-card shadow-sm overflow-hidden h-full flex flex-col"
                style={{
                  gridColumn: `span ${resolvedColSpan} / span ${resolvedColSpan}`,
                  gridRow: `span ${resolvedRowSpan} / span ${resolvedRowSpan}`,
                }}
              >
                {/* Resize handles */}
                <div className="print-hide absolute left-0 top-0 h-2 w-full cursor-ns-resize opacity-0 transition group-hover:opacity-100" onPointerDown={(event) => startResize(report.id, event)} />
                <div className="print-hide absolute bottom-0 left-0 h-2 w-full cursor-ns-resize opacity-0 transition group-hover:opacity-100" onPointerDown={(event) => startResize(report.id, event)} />
                <div className="print-hide absolute left-0 top-0 h-full w-2 cursor-ew-resize opacity-0 transition group-hover:opacity-100" onPointerDown={(event) => startResize(report.id, event)} />
                <div className="print-hide absolute right-0 top-0 h-full w-2 cursor-ew-resize opacity-0 transition group-hover:opacity-100" onPointerDown={(event) => startResize(report.id, event)} />

                {/* Actions — top right, visible on hover */}
                <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 print-hide opacity-0 group-hover:opacity-100 transition">
                  <Button type="button" variant="ghost" size="icon" onClick={() => void exportReportAsImage(report.id)} className="h-7 w-7 bg-card/80 backdrop-blur-sm" title={"Export as image"}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => onPinReport(report.id, !report.pinned)} className="h-7 w-7 bg-card/80 backdrop-blur-sm" title={report.pinned ? "Unpin" : "Pin"}>
                    {report.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setConfirmingReport(report)} className="h-7 w-7 bg-card/80 backdrop-blur-sm text-muted-foreground hover:text-destructive" title={"Delete report"}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Visualization (ReportCard inside renderSpec handles title/summary) */}
                <div className="flex-1 min-h-0 p-4 overflow-hidden">
                  {report.renderSpec ? (
                    <RenderSpecCard renderSpec={report.renderSpec} chartColors={chartColors} specialistId={specialistId} workspaceId={workspaceId} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      {"No chartable data available."}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 pb-2.5 pt-0">
                  <div className="text-[10px] text-muted-foreground/60">{formatTimestamp(report.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={Boolean(confirmingReport)} onOpenChange={(open) => { if (!open) setConfirmingReport(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{"Delete report?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {`This will remove "${confirmingReport?.title ?? ""}" and its chart from this workspace.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{"Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmingReport) { onDeleteReport(confirmingReport.id); setConfirmingReport(null); } }}>
              {"Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{"Chart colors"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {draftColors.map((color, index) => (
              <div key={`color-${index}`} className="flex items-center gap-3">
                <Input type="color" value={color} onChange={(event) => { const next = [...draftColors]; next[index] = event.target.value; setDraftColors(next); }} className="h-10 w-16 p-1" />
                <Input value={color} onChange={(event) => { const next = [...draftColors]; next[index] = event.target.value; setDraftColors(next); }} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfigOpen(false)}>{"Cancel"}</Button>
            <Button type="button" onClick={() => { onChartColorsChange(draftColors.filter((v) => v.trim())); setConfigOpen(false); }}>
              {"Save colors"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
