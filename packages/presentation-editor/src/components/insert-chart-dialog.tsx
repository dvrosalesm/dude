"use client";

import { useState } from "react";
import {
  BarChart3,
  LineChart,
  PieChart,
  Circle,
  AreaChart,
  ScatterChart,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@dude/ui/components/dialog";
import { Button } from "@dude/ui/components/button";
import { Input } from "@dude/ui/components/input";
import type { PptxChartData } from "@dude/presentation-editor/lib/document-editor-actions";

type InsertChartDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (chartData: PptxChartData) => void;
};

const CHART_TYPES: {
  value: PptxChartData["chartType"];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "bar", label: "Bar", icon: BarChart3 },
  { value: "line", label: "Line", icon: LineChart },
  { value: "pie", label: "Pie", icon: PieChart },
  { value: "donut", label: "Donut", icon: Circle },
  { value: "area", label: "Area", icon: AreaChart },
  { value: "scatter", label: "Scatter", icon: ScatterChart },
];

const DEFAULT_HEADERS = ["Category", "Series 1", "Series 2"];
const DEFAULT_DATA = [
  ["Q1", "30", "20"],
  ["Q2", "45", "35"],
  ["Q3", "60", "40"],
  ["Q4", "50", "55"],
];

export function InsertChartDialog({
  open,
  onOpenChange,
  onInsert,
}: InsertChartDialogProps) {
  const [chartType, setChartType] = useState<PptxChartData["chartType"]>("bar");
  const [title, setTitle] = useState("");
  const [headers, setHeaders] = useState<string[]>([...DEFAULT_HEADERS]);
  const [data, setData] = useState<string[][]>(DEFAULT_DATA.map((r) => [...r]));

  const reset = () => {
    setChartType("bar");
    setTitle("");
    setHeaders([...DEFAULT_HEADERS]);
    setData(DEFAULT_DATA.map((r) => [...r]));
  };

  const addRow = () => {
    setData((prev) => [...prev, Array(headers.length).fill("")]);
  };

  const removeRow = (index: number) => {
    if (data.length <= 1) return;
    setData((prev) => prev.filter((_, i) => i !== index));
  };

  const addColumn = () => {
    if (headers.length >= 8) return;
    setHeaders((prev) => [...prev, `Series ${prev.length}`]);
    setData((prev) => prev.map((row) => [...row, ""]));
  };

  const removeColumn = (index: number) => {
    if (headers.length <= 2) return; // Need at least xKey + 1 yKey
    setHeaders((prev) => prev.filter((_, i) => i !== index));
    setData((prev) => prev.map((row) => row.filter((_, i) => i !== index)));
  };

  const updateCell = (row: number, col: number, value: string) => {
    setData((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = value;
      return next;
    });
  };

  const updateHeader = (index: number, value: string) => {
    setHeaders((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleInsert = () => {
    const xKey = headers[0] || "Category";
    const yHeaders = headers.slice(1);
    const yKey = yHeaders.length === 1 ? yHeaders[0] : yHeaders;

    const chartData: Record<string, string | number>[] = data.map((row) => {
      const obj: Record<string, string | number> = {};
      obj[xKey] = row[0] || "";
      for (let i = 1; i < headers.length; i++) {
        const val = row[i];
        const num = Number(val);
        obj[headers[i]] = isNaN(num) ? val || "" : num;
      }
      return obj;
    });

    onInsert({
      chartType,
      title: title || undefined,
      data: chartData,
      xKey,
      yKey,
    });

    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Insert Chart
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Chart type selector */}
          <div>
            <label className="text-sm font-medium text-gray-700">Chart Type</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {CHART_TYPES.map((ct) => {
                const Icon = ct.icon;
                return (
                  <button
                    key={ct.value}
                    type="button"
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                      chartType === ct.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:bg-gray-50 text-gray-700"
                    }`}
                    onClick={() => setChartType(ct.value)}
                  >
                    <Icon className="h-4 w-4" />
                    {ct.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium text-gray-700">Title (optional)</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chart Title"
              className="mt-1"
            />
          </div>

          {/* Data table */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Data</label>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addColumn}
                  disabled={headers.length >= 8}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Column
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addRow}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Row
                </Button>
              </div>
            </div>

            <div className="border rounded overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {headers.map((h, i) => (
                      <th key={i} className="border-r border-b p-0 relative group/th">
                        <Input
                          value={h}
                          onChange={(e) => updateHeader(i, e.target.value)}
                          className="border-0 rounded-none text-xs font-medium h-8 bg-transparent"
                          placeholder={i === 0 ? "X Key" : `Series ${i}`}
                        />
                        {i > 0 && headers.length > 2 && (
                          <button
                            type="button"
                            className="absolute -top-1 -right-1 h-4 w-4 bg-red-100 text-red-600 rounded-full items-center justify-center text-[10px] hidden group-hover/th:flex"
                            onClick={() => removeColumn(i)}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </th>
                    ))}
                    <th className="w-8 border-b" />
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, ri) => (
                    <tr key={ri} className="group/row">
                      {row.map((cell, ci) => (
                        <td key={ci} className="border-r border-b p-0">
                          <Input
                            value={cell}
                            onChange={(e) => updateCell(ri, ci, e.target.value)}
                            className="border-0 rounded-none text-xs h-8 bg-transparent"
                            placeholder={ci === 0 ? "Label" : "0"}
                          />
                        </td>
                      ))}
                      <td className="w-8 border-b text-center">
                        {data.length > 1 && (
                          <button
                            type="button"
                            className="text-gray-300 hover:text-red-500 transition-colors hidden group-hover/row:inline-block"
                            onClick={() => removeRow(ri)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleInsert}>Insert Chart</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
