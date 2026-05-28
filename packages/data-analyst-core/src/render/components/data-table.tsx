"use client";

import { useChartColors } from "../chart-colors-context";

type DataTableProps = {
  columns: Array<{ key: string; label?: string; align?: "left" | "center" | "right" }>;
  data: Array<Record<string, unknown>>;
  striped?: boolean;
};

export function DataTableRenderer({ props }: { props: DataTableProps }) {
  const palette = useChartColors();
  const { columns, data, striped = true } = props;
  const accentColor = palette[0] ?? "#FBB76B";

  if (!columns?.length || !data?.length) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="sticky top-0 z-10 px-3 py-2 font-semibold text-left whitespace-nowrap"
                style={{
                  backgroundColor: accentColor,
                  color: "#1a1a1a",
                  textAlign: col.align ?? "left",
                }}
              >
                {col.label ?? col.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={`border-b border-border/40 transition-colors hover:bg-muted/60 ${
                striped && rowIdx % 2 === 1 ? "bg-muted/30" : ""
              }`}
            >
              {columns.map((col) => {
                const value = row[col.key];
                const display =
                  value === null || value === undefined
                    ? "—"
                    : typeof value === "number"
                      ? value.toLocaleString()
                      : String(value);

                return (
                  <td
                    key={col.key}
                    className="px-3 py-1.5 whitespace-nowrap"
                    style={{ textAlign: col.align ?? (typeof value === "number" ? "right" : "left") }}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
