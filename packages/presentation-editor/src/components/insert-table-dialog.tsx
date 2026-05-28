"use client";

import { useState } from "react";
import { Table2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@dude/ui/components/dialog";
import { Button } from "@dude/ui/components/button";
import { Input } from "@dude/ui/components/input";

type InsertTableDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (tableData: { headers: string[]; rows: string[][] }) => void;
};

export function InsertTableDialog({
  open,
  onOpenChange,
  onInsert,
}: InsertTableDialogProps) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [headers, setHeaders] = useState<string[]>(["Column 1", "Column 2", "Column 3"]);

  const handleColsChange = (newCols: number) => {
    const clamped = Math.max(1, Math.min(10, newCols));
    setCols(clamped);
    setHeaders((prev) => {
      const next = [...prev];
      while (next.length < clamped) next.push(`Column ${next.length + 1}`);
      return next.slice(0, clamped);
    });
  };

  const handleInsert = () => {
    const clampedRows = Math.max(1, Math.min(20, rows));
    const emptyRows = Array.from({ length: clampedRows }, () =>
      Array.from({ length: cols }, () => ""),
    );
    onInsert({ headers: headers.slice(0, cols), rows: emptyRows });
    onOpenChange(false);
  };

  const reset = () => {
    setRows(3);
    setCols(3);
    setHeaders(["Column 1", "Column 2", "Column 3"]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Table2 className="h-5 w-5" />
            Insert Table
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">Rows</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={rows}
                onChange={(e) => setRows(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">Columns</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={cols}
                onChange={(e) => handleColsChange(parseInt(e.target.value) || 1)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Column Headers</label>
            <div className="mt-1 space-y-1.5">
              {headers.slice(0, cols).map((header, i) => (
                <Input
                  key={i}
                  value={header}
                  onChange={(e) => {
                    const next = [...headers];
                    next[i] = e.target.value;
                    setHeaders(next);
                  }}
                  placeholder={`Column ${i + 1}`}
                  className="text-sm"
                />
              ))}
            </div>
          </div>

          {/* Grid preview */}
          <div className="border rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    {headers.slice(0, cols).map((h, i) => (
                      <th key={i} className="px-2 py-1 border-r border-b text-left font-medium truncate max-w-[100px]">
                        {h || `Col ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.min(rows, 5) }, (_, r) => (
                    <tr key={r}>
                      {Array.from({ length: cols }, (_, c) => (
                        <td key={c} className="px-2 py-1 border-r border-b text-gray-400">
                          ...
                        </td>
                      ))}
                    </tr>
                  ))}
                  {rows > 5 && (
                    <tr>
                      <td colSpan={cols} className="px-2 py-1 text-center text-gray-400">
                        +{rows - 5} more rows
                      </td>
                    </tr>
                  )}
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
          <Button onClick={handleInsert}>Insert Table</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
