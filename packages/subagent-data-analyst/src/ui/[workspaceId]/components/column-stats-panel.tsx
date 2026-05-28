"use client";

import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import type { ColumnStats } from "../types";

type ColumnStatsPanelProps = {
  stats: ColumnStats[] | null;
  loading: boolean;
};

function fmt(n: number | undefined): string {
  if (n == null) return "-";
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function ColumnStatsPanel({ stats, loading }: ColumnStatsPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <BrailleSpinner className="text-sm" />
        <span>{"Computing column statistics..."}</span>
      </div>
    );
  }

  if (!stats || stats.length === 0) return null;

  const numericStats = stats.filter((s) => s.type === "numeric");
  const textStats = stats.filter((s) => s.type === "text");

  return (
    <div className="space-y-2 pt-2">
      {numericStats.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 text-left text-muted-foreground">
                <th className="pb-1 pr-4 font-medium">
                  {"Numeric Column"}
                </th>
                <th className="pb-1 pr-4 font-medium text-right">
                  {"Min"}
                </th>
                <th className="pb-1 pr-4 font-medium text-right">
                  {"Max"}
                </th>
                <th className="pb-1 pr-4 font-medium text-right">
                  {"Avg"}
                </th>
                <th className="pb-1 font-medium text-right">
                  {"Median"}
                </th>
              </tr>
            </thead>
            <tbody>
              {numericStats.map((s) => (
                <tr key={s.column} className="border-b border-border/30">
                  <td className="py-1 pr-4 font-medium text-foreground">
                    {s.column}
                  </td>
                  <td className="py-1 pr-4 text-right tabular-nums text-muted-foreground">
                    {fmt(s.min)}
                  </td>
                  <td className="py-1 pr-4 text-right tabular-nums text-muted-foreground">
                    {fmt(s.max)}
                  </td>
                  <td className="py-1 pr-4 text-right tabular-nums text-muted-foreground">
                    {fmt(s.avg)}
                  </td>
                  <td className="py-1 text-right tabular-nums text-muted-foreground">
                    {fmt(s.median)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {textStats.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 text-left text-muted-foreground">
                <th className="pb-1 pr-4 font-medium">
                  {"Text Column"}
                </th>
                <th className="pb-1 font-medium text-right">
                  {"Unique"}
                </th>
              </tr>
            </thead>
            <tbody>
              {textStats.map((s) => (
                <tr key={s.column} className="border-b border-border/30">
                  <td className="py-1 pr-4 font-medium text-foreground">
                    {s.column}
                  </td>
                  <td className="py-1 text-right tabular-nums text-muted-foreground">
                    {fmt(s.cardinality)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
