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


import {
  columnHasIssue,
  ColumnsPanel,
  HeaderBar,
  RowDetailPanel,
  TablesSidebar,
  ColumnDetailPanel,
  firstNonNullSamples,
  getColumnScan,
} from "./data-overview-panels";

export function DataOverviewSection({
  title,
  description,
  loading,
  error,
  overview,
  selectedTable,
  onSelectTable,
  filterText,
  appliedFilterText,
  filterColumn,
  onFilterTextChange,
  onFilterColumnChange,
  onSearch,
  onDeleteTable,
  deletingTable,
  onLoadMoreRecords,
  loadingMoreTable,
  detectedRelationships: _detectedRelationships,
  columnStats,
  columnStatsLoading: _columnStatsLoading,
  qualityScan,
  onChatWithData,
}: DataOverviewSectionProps) {
  const tables = useMemo(() => overview?.tables ?? [], [overview]);
  const [tableFilter, setTableFilter] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  const activeTable = useMemo(
    () =>
      tables.find((table) => table.name === selectedTable) ??
      tables[0] ??
      null,
    [tables, selectedTable],
  );

  const filteredTables = useMemo(() => {
    const query = tableFilter.trim().toLowerCase();
    if (!query) return tables;
    return tables.filter((table) => table.name.toLowerCase().includes(query));
  }, [tables, tableFilter]);

  const activeColumnStats = useMemo(() => {
    if (!activeTable) return null;
    return columnStats?.[activeTable.name] ?? null;
  }, [activeTable, columnStats]);

  const filteredColumns = useMemo(() => {
    if (!activeTable) return [];
    if (!onlyIssues) return activeTable.columns;
    return activeTable.columns.filter((column) => {
      const scan = getColumnScan(activeTable.name, column.name, qualityScan);
      return columnHasIssue(scan);
    });
  }, [activeTable, onlyIssues, qualityScan]);

  if (loading) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {"Loading data..."}
        </p>
      </section>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (tables.length === 0) {
    return (
      <section className="rounded-2xl border border-border/50 bg-card p-12 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">
          {"No tables found."}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      <TablesSidebar
        tables={filteredTables}
        totalCount={tables.length}
        activeTableName={activeTable?.name ?? null}
        filter={tableFilter}
        onFilterChange={setTableFilter}
        onSelectTable={(name) => {
          onSelectTable?.(name);
          setSelectedColumn(null);
          setSelectedRowIndex(null);
        }}
        qualityScan={qualityScan}
      />

      <div className="min-w-0 flex-1 space-y-5">
        {activeTable && (
          <>
            <HeaderBar tableName={activeTable.name} onChatWithData={onChatWithData} />
            <StatsStrip
              table={activeTable}
              qualityScan={qualityScan}
              description={description}
              title={title}
            />
            <ColumnsPanel
              table={activeTable}
              qualityScan={qualityScan}
              columns={filteredColumns}
              onlyIssues={onlyIssues}
              onOnlyIssuesChange={setOnlyIssues}
              filterText={filterText ?? ""}
              filterColumn={filterColumn ?? "__all__"}
              onFilterTextChange={(value) => onFilterTextChange?.(value)}
              onFilterColumnChange={(value) => onFilterColumnChange?.(value)}
              onSearch={() => onSearch?.()}
              appliedFilterText={appliedFilterText ?? ""}
              onDeleteTable={onDeleteTable}
              deletingTable={deletingTable ?? null}
              onLoadMoreRecords={onLoadMoreRecords}
              loadingMoreTable={loadingMoreTable ?? null}
              selectedColumn={selectedColumn}
              onSelectColumn={(name) => {
                setSelectedColumn(name);
                setSelectedRowIndex(null);
              }}
              selectedRowIndex={selectedRowIndex}
              onSelectRow={(index) => {
                setSelectedRowIndex(index);
                setSelectedColumn(null);
              }}
            />
          </>
        )}
      </div>

      {activeTable && selectedRowIndex != null && activeTable.preview?.rows[selectedRowIndex] && (
        <RowDetailPanel
          tableName={activeTable.name}
          rowIndex={selectedRowIndex}
          row={activeTable.preview.rows[selectedRowIndex]}
          columns={activeTable.columns}
          qualityScan={qualityScan}
          onClose={() => setSelectedRowIndex(null)}
        />
      )}
      {activeTable && selectedColumn && selectedRowIndex == null && (
        <ColumnDetailPanel
          tableName={activeTable.name}
          columnName={selectedColumn}
          columnIndex={activeTable.columns.findIndex(
            (column) => column.name === selectedColumn,
          )}
          columnType={
            activeTable.columns.find((c) => c.name === selectedColumn)?.type ??
            "text"
          }
          columnScan={getColumnScan(
            activeTable.name,
            selectedColumn,
            qualityScan,
          )}
          columnStats={activeColumnStats?.find(
            (s) => s.column === selectedColumn,
          )}
          previewSample={firstNonNullSamples(activeTable.preview, selectedColumn, 5)}
          onClose={() => setSelectedColumn(null)}
        />
      )}
    </section>
  );
}
