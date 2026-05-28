"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  MessageCircle,
  Plus,
  Search,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@dude/ui/components/button";
import { Input } from "@dude/ui/components/input";
import { Switch } from "@dude/ui/components/switch";
import type {
  DataOverview,
  DataOverviewTable,
  DetectedRelationship,
  ColumnStats,
  QualityScanResult,
  QualityScanColumn,
  SqlQueryResult,
} from "../types";

type DataOverviewSectionProps = {
  title: string;
  description: string;
  loading: boolean;
  error?: string | null;
  overview?: DataOverview | null;
  selectedTable?: string | null;
  onSelectTable?: (tableName: string) => void;
  filterText?: string;
  appliedFilterText?: string;
  filterColumn?: string;
  onFilterTextChange?: (value: string) => void;
  onFilterColumnChange?: (value: string) => void;
  onSearch?: () => void;
  onDeleteTable?: (tableName: string) => void;
  deletingTable?: string | null;
  onLoadMoreRecords?: (tableName: string) => void;
  loadingMoreTable?: string | null;
  detectedRelationships?: DetectedRelationship[];
  columnStats?: Record<string, ColumnStats[]> | null;
  columnStatsLoading?: boolean;
  qualityScan?: QualityScanResult | null;
  onChatWithData?: () => void;
};

function typeBadgeClass(type: string) {
  switch (type) {
    case "number":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "date":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "boolean":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "id":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function inferBadgeKind(columnName: string, declaredType: string) {
  const name = columnName.toLowerCase();
  if (/^id$|_id$|^id_/.test(name)) return "id";
  return declaredType;
}

function qualityColor(score: number) {
  if (score >= 90) return "text-emerald-600";
  if (score >= 70) return "text-amber-600";
  return "text-red-600";
}

function qualityRing(score: number) {
  if (score >= 90) return "stroke-emerald-500";
  if (score >= 70) return "stroke-amber-500";
  return "stroke-red-500";
}

function QualityDonut({ score }: { score: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" className="shrink-0">
      <circle
        cx="30"
        cy="30"
        r={radius}
        fill="none"
        strokeWidth="4"
        className="stroke-muted/50"
      />
      <circle
        cx="30"
        cy="30"
        r={radius}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        transform="rotate(-90 30 30)"
        className={qualityRing(score)}
      />
    </svg>
  );
}

function computeTableQuality(
  tableName: string,
  qualityScan?: QualityScanResult | null,
): { score: number; issueCount: number } {
  if (!qualityScan) return { score: 100, issueCount: 0 };
  const tableScan = qualityScan.tables.find((t) => t.table === tableName);
  if (!tableScan || tableScan.totalRows === 0) {
    return { score: qualityScan.overallScore, issueCount: 0 };
  }
  let totalNulls = 0;
  let totalCells = 0;
  let issueCount = 0;
  for (const col of tableScan.columns) {
    totalNulls += col.nullCount + col.emptyCount;
    totalCells += col.totalRows;
    const ratio = col.totalRows > 0 ? (col.nullCount + col.emptyCount) / col.totalRows : 0;
    if (ratio >= 0.25) issueCount += 1;
  }
  const score =
    totalCells > 0 ? Math.round((1 - totalNulls / totalCells) * 100) : 100;
  return { score, issueCount };
}

function computeNullPercent(
  tableName: string,
  qualityScan?: QualityScanResult | null,
) {
  if (!qualityScan) return 0;
  const tableScan = qualityScan.tables.find((t) => t.table === tableName);
  if (!tableScan || tableScan.totalRows === 0) return 0;
  let nulls = 0;
  let cells = 0;
  for (const col of tableScan.columns) {
    nulls += col.nullCount + col.emptyCount;
    cells += col.totalRows;
  }
  return cells > 0 ? Math.round((nulls / cells) * 100) : 0;
}

function fullyNullColumnsCount(
  tableName: string,
  qualityScan?: QualityScanResult | null,
) {
  if (!qualityScan) return 0;
  const tableScan = qualityScan.tables.find((t) => t.table === tableName);
  if (!tableScan) return 0;
  return tableScan.columns.filter(
    (col) => col.totalRows > 0 && col.nullCount + col.emptyCount === col.totalRows,
  ).length;
}

export function getColumnScan(
  tableName: string,
  columnName: string,
  qualityScan?: QualityScanResult | null,
): QualityScanColumn | undefined {
  if (!qualityScan) return undefined;
  const tableScan = qualityScan.tables.find((t) => t.table === tableName);
  return tableScan?.columns.find((c) => c.column === columnName);
}

export function columnHasIssue(scan?: QualityScanColumn) {
  if (!scan || scan.totalRows === 0) return false;
  const ratio = (scan.nullCount + scan.emptyCount) / scan.totalRows;
  return ratio >= 0.25;
}

function formatCount(n: number) {
  return n.toLocaleString();
}


export function firstNonNullSamples(
  preview: SqlQueryResult | undefined,
  columnName: string,
  limit: number,
) {
  if (!preview) return [];
  const out: string[] = [];
  for (const row of preview.rows) {
    const value = row[columnName];
    if (value == null || value === "") continue;
    const asString = String(value);
    if (out.includes(asString)) continue;
    out.push(asString);
    if (out.length >= limit) break;
  }
  return out;
}

export function TablesSidebar({
  tables,
  totalCount,
  activeTableName,
  filter,
  onFilterChange,
  onSelectTable,
  qualityScan,
}: {
  tables: DataOverviewTable[];
  totalCount: number;
  activeTableName: string | null;
  filter: string;
  onFilterChange: (value: string) => void;
  onSelectTable: (name: string) => void;
  qualityScan?: QualityScanResult | null;
}) {
  return (
    <aside className="w-full space-y-3 lg:w-60 lg:shrink-0">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {"Tables"}
          </span>
          <span className="text-xs text-muted-foreground">{totalCount}</span>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label="Add table"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="relative px-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder={"Filter tables..."}
          className="h-9 pl-8 text-xs bg-card border border-border/50 shadow-sm rounded-lg"
        />
      </div>
      <ul className="space-y-1">
        {tables.map((table) => {
          const isActive = activeTableName === table.name;
          const quality = computeTableQuality(table.name, qualityScan);
          return (
            <li key={table.name}>
              <button
                type="button"
                onClick={() => onSelectTable(table.name)}
                className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                  isActive
                    ? "bg-muted/70"
                    : "hover:bg-muted/40"
                }`}
              >
                <Table2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs font-medium">
                      {table.name}
                    </span>
                    {quality.issueCount > 0 && (
                      <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                        {quality.issueCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>
                      {formatCount(table.rowCount) + "r · " + table.columns.length + "c"}
                    </span>
                    <span>·</span>
                    <span className={qualityColor(quality.score)}>
                      {quality.score}%
                    </span>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export function HeaderBar({
  tableName,
  onChatWithData,
}: {
  tableName: string;
  onChatWithData?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{"workspace"}</span>
          <ChevronRight className="h-3 w-3" />
          <span>{"tables"}</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-mono font-medium text-foreground">{tableName}</span>
        </nav>
        <h2 className="text-2xl font-semibold tracking-tight">{tableName}</h2>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onChatWithData}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all active:translate-y-[1px] active:shadow-none"
          style={{
            background: "linear-gradient(180deg, #E7C59A, #E7C59A)",
            boxShadow: "0 2px 0 0 #E7C59A, 0 4px 10px rgba(231,197,154,0.25)",
          }}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {"Chat with data"}
        </button>
      </div>
    </div>
  );
}

export function StatsStrip({
  table,
  qualityScan,
  title: _title,
  description: _description,
}: {
  table: DataOverviewTable;
  qualityScan?: QualityScanResult | null;
  title: string;
  description: string;
}) {
  const quality = computeTableQuality(table.name, qualityScan);
  const nullPct = computeNullPercent(table.name, qualityScan);
  const fullyNull = fullyNullColumnsCount(table.name, qualityScan);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard
        label={"Quality"}
        leading={<QualityDonut score={quality.score} />}
      >
        <div className={`text-2xl font-semibold ${qualityColor(quality.score)}`}>
          {quality.score}%
        </div>
        <p className="text-[11px] text-muted-foreground">
          {quality.issueCount + " issues to fix"}
        </p>
      </StatCard>
      <StatCard label={"Rows"}>
        <div className="text-2xl font-semibold tabular-nums">
          {formatCount(table.rowCount)}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {table.rowCount < 50
            ? "sparse"
            : " "}
        </p>
      </StatCard>
      <StatCard label={"Columns"}>
        <div className="text-2xl font-semibold tabular-nums">
          {table.columns.length}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {fullyNull > 0
            ? fullyNull + " fully null"
            : " "}
        </p>
      </StatCard>
      <StatCard label={"Null %"}>
        <div
          className={`text-2xl font-semibold tabular-nums ${
            nullPct >= 25 ? "text-amber-600" : "text-foreground"
          }`}
        >
          {nullPct}%
        </div>
        <p className="text-[11px] text-muted-foreground">
          {"across cells"}
        </p>
      </StatCard>
      <StatCard label={"Storage"}>
        <div className="text-2xl font-semibold tabular-nums text-muted-foreground">
          —
        </div>
        <p className="text-[11px] text-muted-foreground">&nbsp;</p>
      </StatCard>
    </div>
  );
}

export function StatCard({
  label,
  leading,
  children,
}: {
  label: string;
  leading?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm">
      {leading}
      <div className="min-w-0 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {children}
      </div>
    </div>
  );
}

export function ColumnsPanel({
  table,
  qualityScan,
  columns,
  onlyIssues,
  onOnlyIssuesChange,
  filterText,
  filterColumn,
  onFilterTextChange,
  onFilterColumnChange,
  onSearch,
  appliedFilterText,
  onDeleteTable,
  deletingTable,
  onLoadMoreRecords,
  loadingMoreTable,
  selectedColumn,
  onSelectColumn,
  selectedRowIndex,
  onSelectRow,
}: {
  table: DataOverviewTable;
  qualityScan?: QualityScanResult | null;
  columns: DataOverviewTable["columns"];
  onlyIssues: boolean;
  onOnlyIssuesChange: (value: boolean) => void;
  filterText: string;
  filterColumn: string;
  onFilterTextChange: (value: string) => void;
  onFilterColumnChange: (value: string) => void;
  onSearch: () => void;
  appliedFilterText: string;
  onDeleteTable?: (name: string) => void;
  deletingTable: string | null;
  onLoadMoreRecords?: (name: string) => void;
  loadingMoreTable: string | null;
  selectedColumn: string | null;
  onSelectColumn: (name: string | null) => void;
  selectedRowIndex: number | null;
  onSelectRow: (index: number | null) => void;
}) {
  const rows = table.preview?.rows ?? [];
  const filterActive = Boolean(appliedFilterText.trim());
  const totalCount = filterActive
    ? table.filteredRowCount ?? rows.length
    : table.rowCount;
  const hasMore = rows.length < totalCount;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">
            {"Columns"}
          </span>
          <span className="text-xs text-muted-foreground">
            {columns.length + " of " + table.columns.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={onlyIssues}
              onCheckedChange={onOnlyIssuesChange}
            />
            {"Only issues"}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filterText}
              onChange={(event) => onFilterTextChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSearch();
                }
              }}
              placeholder={"Filter rows..."}
              className="h-9 w-52 pl-8 text-xs bg-card border border-border/50 shadow-sm rounded-lg"
            />
          </div>
          <select
            value={filterColumn}
            onChange={(event) => onFilterColumnChange(event.target.value)}
            className="h-9 rounded-lg border border-border/50 bg-card px-2 text-xs shadow-sm"
          >
            <option value="__all__">
              {"All columns"}
            </option>
            {table.columns.map((column) => (
              <option key={column.name} value={column.name}>
                {column.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium">{table.name}</span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {rows.length + " rows"}
            </span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {columns.length + " of " + table.columns.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onDeleteTable && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={deletingTable === table.name}
                onClick={() => onDeleteTable(table.name)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {deletingTable === table.name
                  ? "Deleting..."
                  : "Delete"}
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 text-left">
                <th className="w-10 px-3 py-2 text-muted-foreground">#</th>
                {columns.map((column) => {
                  const scan = getColumnScan(table.name, column.name, qualityScan);
                  const flagged = columnHasIssue(scan);
                  const badgeKind = inferBadgeKind(column.name, column.type);
                  const isSelected = selectedColumn === column.name;
                  return (
                    <th
                      key={column.name}
                      className={`min-w-[160px] cursor-pointer px-3 py-2 align-top ${
                        isSelected ? "bg-muted/40" : ""
                      }`}
                      onClick={() =>
                        onSelectColumn(isSelected ? null : column.name)
                      }
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-md border px-1.5 text-[10px] font-medium ${typeBadgeClass(badgeKind)}`}
                          >
                            {badgeKind}
                          </span>
                          {flagged && (
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                        <div className="font-mono text-[13px] font-medium text-foreground">
                          {column.name}
                        </div>
                        <ColumnHealthBar scan={scan} />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    {"No tables found."}
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => {
                  const isSelectedRow = selectedRowIndex === rowIndex;
                  return (
                    <tr
                      key={`row-${rowIndex}`}
                      onClick={() =>
                        onSelectRow(isSelectedRow ? null : rowIndex)
                      }
                      className={`cursor-pointer border-b border-border/30 transition-colors last:border-none hover:bg-muted/30 ${
                        isSelectedRow ? "bg-muted/50" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">
                        {rowIndex + 1}
                      </td>
                      {columns.map((column) => {
                        const value = row[column.name];
                        const isNull = value == null || value === "";
                        return (
                          <td
                            key={`${column.name}-${rowIndex}`}
                            className={`px-3 py-2 align-top ${isNull ? "italic text-muted-foreground/70" : ""} ${
                              selectedColumn === column.name ? "bg-muted/20" : ""
                            }`}
                          >
                            {isNull ? "null" : String(value)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {onLoadMoreRecords && hasMore && (
          <div className="flex items-center justify-end border-t border-border/50 px-4 py-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onLoadMoreRecords(table.name)}
              disabled={loadingMoreTable === table.name}
            >
              {loadingMoreTable === table.name
                ? "Loading..."
                : "Load more (" + rows.length + "/" + totalCount + ")"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ColumnHealthBar({ scan }: { scan?: QualityScanColumn }) {
  if (!scan || scan.totalRows === 0) {
    return <div className="h-1 rounded-full bg-muted/60" />;
  }
  const nonNull = Math.max(0, scan.totalRows - scan.nullCount - scan.emptyCount);
  const filled = (nonNull / scan.totalRows) * 100;
  const color =
    filled >= 90
      ? "bg-emerald-400"
      : filled >= 70
        ? "bg-amber-400"
        : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/50">
        <div className={`h-full ${color}`} style={{ width: `${filled}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {Math.round(filled)}
      </span>
    </div>
  );
}

export function ColumnDetailPanel({
  tableName: _tableName,
  columnName,
  columnIndex,
  columnType,
  columnScan,
  columnStats,
  previewSample,
  onClose: _onClose,
}: {
  tableName: string;
  columnName: string;
  columnIndex: number;
  columnType: string;
  columnScan?: QualityScanColumn;
  columnStats?: ColumnStats;
  previewSample: string[];
  onClose: () => void;
}) {
  const badgeKind = inferBadgeKind(columnName, columnType);
  const flagged = columnHasIssue(columnScan);
  const nulls = columnScan
    ? columnScan.nullCount + columnScan.emptyCount
    : 0;
  const nullPct =
    columnScan && columnScan.totalRows > 0
      ? Math.round((nulls / columnScan.totalRows) * 100)
      : 0;
  const unique = columnStats?.cardinality;
  const rows = columnScan?.totalRows ?? columnStats?.totalRows ?? 0;
  const health =
    columnScan && columnScan.totalRows > 0
      ? Math.round(
          ((columnScan.totalRows - nulls) / columnScan.totalRows) * 100,
        )
      : 100;

  const showDistribution =
    columnStats?.type === "numeric" &&
    (columnStats.min != null || columnStats.max != null || columnStats.avg != null);

  return (
    <aside className="w-full space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-sm lg:w-72 lg:shrink-0">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md border px-1.5 text-[10px] font-medium ${typeBadgeClass(badgeKind)}`}
          >
            {badgeKind}
          </span>
          {flagged && (
            <span className="flex items-center gap-1 text-[11px] text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              {"needs review"}
            </span>
          )}
        </div>
        <h3 className="font-mono text-base font-semibold">{columnName}</h3>
        <p className="text-[11px] text-muted-foreground">
          {"column " + columnIndex + 1}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <DetailStat
          label={"Nulls"}
          value={`${nullPct}%`}
          tone={nullPct >= 25 ? "warn" : undefined}
        />
        <DetailStat
          label={"Unique"}
          value={unique != null ? formatCount(unique) : "—"}
        />
        <DetailStat
          label={"Rows"}
          value={formatCount(rows)}
        />
        <DetailStat
          label={"Health"}
          value={String(health)}
          tone={health < 70 ? "warn" : undefined}
        />
      </div>

      {flagged && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-start gap-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {nullPct + "% nulls"}
            </span>
          </p>
        </div>
      )}

      {showDistribution && columnStats && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {"Distribution"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <DetailStat
              label={"Min"}
              value={fmt(columnStats.min)}
            />
            <DetailStat
              label={"Max"}
              value={fmt(columnStats.max)}
            />
            <DetailStat
              label={"Avg"}
              value={fmt(columnStats.avg)}
            />
            <DetailStat
              label={"Median"}
              value={fmt(columnStats.median)}
            />
          </div>
        </div>
      )}

      {previewSample.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {"Sample values"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {previewSample.map((value, index) => (
              <span
                key={`${value}-${index}`}
                className="rounded-md border border-border/50 bg-muted/30 px-2 py-1 text-[11px]"
              >
                {value}
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export function DetailStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`text-sm font-semibold tabular-nums ${
          tone === "warn" ? "text-amber-600" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function fmt(n: number | undefined) {
  if (n == null) return "—";
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function RowDetailPanel({
  tableName,
  rowIndex,
  row,
  columns,
  qualityScan,
  onClose,
}: {
  tableName: string;
  rowIndex: number;
  row: Record<string, unknown>;
  columns: DataOverviewTable["columns"];
  qualityScan?: QualityScanResult | null;
  onClose: () => void;
}) {
  const filled = columns.filter((column) => {
    const value = row[column.name];
    return value != null && value !== "";
  }).length;
  const health = columns.length > 0 ? Math.round((filled / columns.length) * 100) : 0;

  return (
    <aside className="w-full space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-sm lg:w-80 lg:shrink-0">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {"Row " + rowIndex + 1}
          </p>
          <h3 className="font-mono text-base font-semibold">
            #{rowIndex + 1}
          </h3>
          <p className="text-[11px] text-muted-foreground">{tableName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <DetailStat
          label={"Filled"}
          value={`${filled}/${columns.length}`}
        />
        <DetailStat
          label={"Health"}
          value={`${health}%`}
          tone={health < 70 ? "warn" : undefined}
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {"Fields"}
        </p>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {columns.map((column) => {
            const value = row[column.name];
            const isNull = value == null || value === "";
            const scan = getColumnScan(tableName, column.name, qualityScan);
            const badgeKind = inferBadgeKind(column.name, column.type);
            const flagged = columnHasIssue(scan);
            return (
              <div
                key={column.name}
                className="space-y-1 rounded-lg border border-border/50 bg-card px-3 py-2"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-md border px-1.5 text-[10px] font-medium ${typeBadgeClass(badgeKind)}`}
                  >
                    {badgeKind}
                  </span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {column.name}
                  </span>
                  {flagged && (
                    <AlertTriangle className="ml-auto h-3 w-3 text-amber-500" />
                  )}
                </div>
                <div
                  className={`text-[12px] ${
                    isNull
                      ? "italic text-muted-foreground/70"
                      : "font-medium text-foreground"
                  }`}
                >
                  {isNull ? "null" : String(value)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

