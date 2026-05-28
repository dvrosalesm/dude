"use client";

import { useMemo, useState } from "react";
import type { SqlQueryResult } from "../types";
import { Input } from "@dude/ui/components/input";
import { Button } from "@dude/ui/components/button";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type SqlResultTableProps = {
  result: SqlQueryResult;
  showControls?: boolean;
};

type SortDirection = "asc" | "desc";

export function SqlResultTable({
  result,
  showControls = true,
}: SqlResultTableProps) {
  const [filterText, setFilterText] = useState("");
  const [filterColumn, setFilterColumn] = useState<string>("__all__");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const filteredRows = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) return result.rows;
    return result.rows.filter((row) => {
      if (filterColumn !== "__all__") {
        const value = row[filterColumn];
        return String(value ?? "")
          .toLowerCase()
          .includes(query);
      }
      return result.columns.some((column) =>
        String(row[column] ?? "")
          .toLowerCase()
          .includes(query),
      );
    });
  }, [filterText, filterColumn, result.rows, result.columns]);

  const sortedRows = useMemo(() => {
    if (!sortColumn) return filteredRows;
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];
      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * direction;
      }
      return String(aValue).localeCompare(String(bValue)) * direction;
    });
  }, [filteredRows, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection("asc");
  };

  if (!result.columns.length) {
    return (
      <div className="text-xs text-muted-foreground">
        {"Query returned no rows."}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showControls && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            placeholder={"Filter rows"}
            className="h-8 w-full sm:w-64 text-xs"
          />
          <select
            value={filterColumn}
            onChange={(event) => setFilterColumn(event.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            <option value="__all__">
              {"All columns"}
            </option>
            {result.columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => {
              setFilterText("");
              setFilterColumn("__all__");
              setSortColumn(null);
              setSortDirection("asc");
            }}
          >
            {"Reset"}
          </Button>
          <div className="ml-auto text-xs text-muted-foreground">
            {sortedRows.length + " of " + result.rows.length + " rows"}
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl bg-card shadow-sm">
        <table className="min-w-full divide-y divide-border/30 text-xs">
          <thead className="bg-muted/20">
            <tr>
              {result.columns.map((column) => (
                <th
                  key={column}
                  className="px-3 py-2 text-left font-semibold text-muted-foreground"
                >
                  <button
                    type="button"
                    onClick={() => handleSort(column)}
                    className="inline-flex items-center gap-1 text-left"
                  >
                    <span>{column}</span>
                    {sortColumn === column ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {sortedRows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {result.columns.map((column) => (
                  <td key={`${rowIndex}-${column}`} className="px-3 py-2">
                    {row[column] === null || row[column] === undefined
                      ? ""
                      : String(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
