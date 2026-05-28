"use client";

import { useEffect, useState } from "react";
import type { DataOverview, Workspace, WorkspaceSchema, WorkspaceTab } from "../types";

export function useDataOverview({
  workspace,
  setWorkspace,
  activeTab,
  isLoading,
  runSql,
}: {
  workspace: Workspace | null;
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace | null>>;
  activeTab: WorkspaceTab;
  isLoading: boolean;
  runSql: (query: string) => Promise<{ columns: string[]; rows: Array<Record<string, unknown>> }>;
}) {
  const [dataOverview, setDataOverview] = useState<DataOverview | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [deletingTable, setDeletingTable] = useState<string | null>(null);
  const [loadingMoreTable, setLoadingMoreTable] = useState<string | null>(null);
  const [tablePreviewLimits, setTablePreviewLimits] = useState<
    Record<string, number>
  >({});
  const [selectedTableName, setSelectedTableName] = useState<string | null>(
    null,
  );
  const [dataFilterTextInput, setDataFilterTextInput] = useState("");
  const [dataFilterText, setDataFilterText] = useState("");
  const [dataFilterColumn, setDataFilterColumn] = useState("__all__");

  useEffect(() => {
    if (activeTab !== "data") return;
    if (isLoading || !workspace) return;
    void loadDataOverview();
  }, [
    activeTab,
    dataFilterText,
    dataFilterColumn,
    selectedTableName,
    isLoading,
    workspace,
  ]);

  useEffect(() => {
    const tableNames = dataOverview?.tables.map((table) => table.name) ?? [];
    if (!tableNames.length) {
      setSelectedTableName(null);
      return;
    }
    if (!selectedTableName || !tableNames.includes(selectedTableName)) {
      setSelectedTableName(tableNames[0]);
    }
  }, [dataOverview, selectedTableName]);

  useEffect(() => {
    const columns =
      dataOverview?.tables.find((table) => table.name === selectedTableName)
        ?.columns ?? [];
    if (dataFilterColumn === "__all__") return;
    if (!columns.some((column) => column.name === dataFilterColumn)) {
      setDataFilterColumn("__all__");
    }
  }, [dataFilterColumn, dataOverview, selectedTableName]);

  function buildWhereClause({
    columns,
    filterText,
    filterColumn,
  }: {
    columns: Array<{ name: string }>;
    filterText: string;
    filterColumn: string;
  }) {
    const normalizedFilter = filterText.trim();
    if (!normalizedFilter) return null;

    const escaped = normalizedFilter
      .replace(/!/g, "!!")
      .replace(/%/g, "!%")
      .replace(/_/g, "!_")
      .replace(/'/g, "''");

    const columnsToSearch =
      filterColumn === "__all__"
        ? columns.map((column) => column.name)
        : columns
            .map((column) => column.name)
            .filter((column) => column === filterColumn);

    if (!columnsToSearch.length) return null;

    return columnsToSearch
      .map(
        (column) =>
          `COALESCE(CAST("${column}" AS TEXT), '') LIKE '%${escaped}%' ESCAPE '!'`,
      )
      .join(" OR ");
  }

  function quoteQualifiedName(name: string) {
    return name
      .split(".")
      .map((part) => `"${part.replace(/"/g, '""')}"`)
      .join(".");
  }

  function buildPreviewQuery({
    tableName,
    columns,
    limit,
    filterText,
    filterColumn,
  }: {
    tableName: string;
    columns: Array<{ name: string }>;
    limit: number;
    filterText: string;
    filterColumn: string;
  }) {
    const whereClause = buildWhereClause({
      columns,
      filterText,
      filterColumn,
    });

    if (!whereClause) {
      return `SELECT * FROM ${quoteQualifiedName(tableName)} LIMIT ${limit};`;
    }

    return `SELECT * FROM ${quoteQualifiedName(tableName)} WHERE (${whereClause}) LIMIT ${limit};`;
  }

  function buildCountQuery({
    tableName,
    columns,
    filterText,
    filterColumn,
  }: {
    tableName: string;
    columns: Array<{ name: string }>;
    filterText: string;
    filterColumn: string;
  }) {
    const whereClause = buildWhereClause({
      columns,
      filterText,
      filterColumn,
    });
    if (!whereClause) {
      return `SELECT COUNT(*) as count FROM ${quoteQualifiedName(tableName)};`;
    }
    return `SELECT COUNT(*) as count FROM ${quoteQualifiedName(tableName)} WHERE (${whereClause});`;
  }

  async function loadDataOverview() {
    if (!workspace) return;
    setDataLoading(true);
    setDataError(null);
    try {
      let tableNames: string[] = [];
      if (workspace?.configurations?.schema?.tables) {
        tableNames = Object.keys(workspace.configurations.schema.tables);
      } else {
        const result = await runSql(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_specialist_reports' ORDER BY name;",
        );
        tableNames = result.rows.map((row) => String(row.name));
      }

      const tables = [];
      for (const tblName of tableNames) {
        const schemaTable =
          workspace?.configurations?.schema?.tables?.[tblName];
        let columns = schemaTable?.columns || [];
        if (!columns.length) {
          const pragmaResult = await runSql(
            `PRAGMA table_info("${tblName}");`,
          );
          columns =
            pragmaResult.rows.map((row) => ({
              name: String(row.name),
              type: String(row.type || "text"),
            })) || [];
        }

        let rowCount = schemaTable?.rowCount ?? 0;
        if (!rowCount) {
          const countResult = await runSql(
            `SELECT COUNT(*) as count FROM ${quoteQualifiedName(tblName)};`,
          );
          rowCount = Number(countResult.rows?.[0]?.count || 0);
        }

        const previewLimit = tablePreviewLimits[tblName] ?? 25;
        const isSelectedTable = tblName === selectedTableName;
        const filterText = isSelectedTable ? dataFilterText : "";
        const filterColumn = isSelectedTable ? dataFilterColumn : "__all__";
        const preview = await runSql(
          buildPreviewQuery({
            tableName: tblName,
            columns,
            limit: previewLimit,
            filterText,
            filterColumn,
          }),
        );
        const filteredRowCount = filterText
          ? Number(
              (
                await runSql(
                  buildCountQuery({
                    tableName: tblName,
                    columns,
                    filterText,
                    filterColumn,
                  }),
                )
              ).rows?.[0]?.count ?? 0,
            )
          : null;
        tables.push({
          name: tblName,
          columns,
          rowCount,
          preview,
          filteredRowCount,
        });
      }

      setDataOverview({ tables });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load data.";
      setDataError(message);
    } finally {
      setDataLoading(false);
    }
  }

  async function handleDeleteTable(tableNameToDelete: string) {
    if (!workspace) return;
    const confirmed = window.confirm(
      "Delete table \"" + tableNameToDelete + "\"? This cannot be undone.",
    );
    if (!confirmed) return;
    setDeletingTable(tableNameToDelete);
    try {
      const nextSchema: WorkspaceSchema | null = workspace?.configurations
        ?.schema
        ? {
            ...workspace.configurations.schema,
            tables: Object.fromEntries(
              Object.entries(workspace.configurations.schema.tables).filter(
                ([name]) => name !== tableNameToDelete,
              ),
            ),
            updatedAt: new Date().toISOString(),
          }
        : null;

      setWorkspace((prev) =>
        prev
          ? {
              ...prev,
              configurations: {
                ...prev.configurations,
                schema: nextSchema || prev.configurations?.schema,
              },
            }
          : prev,
      );
      await loadDataOverview();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to delete table.";
      setDataError(message);
    } finally {
      setDeletingTable(null);
    }
  }

  async function handleLoadMoreRecords(tableNameToLoad: string) {
    setLoadingMoreTable(tableNameToLoad);
    const effectiveFilterText = dataFilterTextInput;
    const effectiveFilterColumn = dataFilterColumn;
    if (dataFilterText !== effectiveFilterText) {
      setDataFilterText(effectiveFilterText);
    }
    const nextLimit = (tablePreviewLimits[tableNameToLoad] ?? 25) + 25;
    setTablePreviewLimits((prev) => ({ ...prev, [tableNameToLoad]: nextLimit }));
    try {
      const columns =
        dataOverview?.tables.find((table) => table.name === tableNameToLoad)
          ?.columns ?? [];
      const preview = await runSql(
        buildPreviewQuery({
          tableName: tableNameToLoad,
          columns,
          limit: nextLimit,
          filterText:
            tableNameToLoad === selectedTableName ? effectiveFilterText : "",
          filterColumn:
            tableNameToLoad === selectedTableName ? effectiveFilterColumn : "__all__",
        }),
      );
      setDataOverview((prev) =>
        prev
          ? {
              tables: prev.tables.map((table) =>
                table.name === tableNameToLoad ? { ...table, preview } : table,
              ),
            }
          : prev,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load more data.";
      setDataError(message);
    } finally {
      setLoadingMoreTable(null);
    }
  }

  function handleSearchData() {
    setDataFilterText(dataFilterTextInput);
  }

  return {
    dataOverview,
    dataLoading,
    dataError,
    deletingTable,
    loadingMoreTable,
    selectedTableName,
    setSelectedTableName,
    dataFilterTextInput,
    setDataFilterTextInput,
    dataFilterText,
    dataFilterColumn,
    setDataFilterColumn,
    handleDeleteTable,
    handleLoadMoreRecords,
    handleSearchData,
  };
}
