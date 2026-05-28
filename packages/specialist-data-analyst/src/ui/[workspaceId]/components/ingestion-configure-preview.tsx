"use client";

import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dude/ui/components/table";
import type { ColumnStat } from "../utils";
import { ColumnHeaderCell } from "./ingestion-configure-widgets";

export function PreviewTable({
  headers,
  rows,
  mappings,
  stats,
}: {
  headers: string[];
  rows: Array<Array<string>>;
  mappings: Record<string, string>;
  stats: ColumnStat[];
}) {
  const statByHeader = useMemo(() => {
    const map = new Map<string, ColumnStat>();
    for (const stat of stats) map.set(stat.header, stat);
    return map;
  }, [stats]);

  return (
    <div className="overflow-auto rounded-2xl border border-border/50 bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-xs text-muted-foreground">
              #
            </TableHead>
            {headers.map((header) => (
              <TableHead key={header} className="min-w-[160px]">
                <ColumnHeaderCell
                  header={header}
                  rename={mappings[header] ?? header}
                  stat={statByHeader.get(header)}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={`preview-${rowIndex}`}>
              <TableCell className="text-xs text-muted-foreground">
                {rowIndex + 1}
              </TableCell>
              {row.map((cell, cellIndex) => (
                <TableCell
                  key={`cell-${rowIndex}-${cellIndex}`}
                  className={cell ? "" : "italic text-muted-foreground"}
                >
                  {cell || "null"}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
