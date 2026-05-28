"use client";

import { useCallback, useMemo, useState } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Search, Shapes } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@dude/ui/components/dialog";
import { Button } from "@dude/ui/components/button";
import { cn } from "@dude/ui/utils";
import { searchIcons, type IconEntry } from "@dude/presentation-editor/lib/icon-library";

const COLOR_PRESETS = [
  "#0f172a", "#111111", "#ffffff", "#ef4444",
  "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
];

const RASTER_SIZE = 512;

/** Render a Lucide icon to SVG markup, then rasterize to a PNG data URL. */
async function iconToPng(entry: IconEntry, color: string): Promise<string> {
  const svgMarkup = renderToStaticMarkup(
    createElement(entry.Component, {
      size: RASTER_SIZE,
      color,
      strokeWidth: 1.75,
      absoluteStrokeWidth: false,
    }),
  );

  // Inline the color via currentColor in case the icon uses it internally
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load SVG icon"));
      image.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = RASTER_SIZE;
    canvas.height = RASTER_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    ctx.clearRect(0, 0, RASTER_SIZE, RASTER_SIZE);
    ctx.drawImage(img, 0, 0, RASTER_SIZE, RASTER_SIZE);

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

type InsertIconDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with raw base64 (no data URL prefix) + content type. */
  onInsert: (imageBase64: string, contentType: string) => void;
};

export function InsertIconDialog({
  open,
  onOpenChange,
  onInsert,
}: InsertIconDialogProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<IconEntry | null>(null);
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [inserting, setInserting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => searchIcons(query, 180), [query]);

  const reset = useCallback(() => {
    setQuery("");
    setSelected(null);
    setColor(COLOR_PRESETS[0]);
    setError(null);
  }, []);

  const handleInsert = useCallback(async () => {
    if (!selected) return;
    setInserting(true);
    setError(null);
    try {
      const dataUrl = await iconToPng(selected, color);
      const base64 = dataUrl.split(",")[1];
      if (!base64) throw new Error("Failed to extract icon PNG data");
      onInsert(base64, "image/png");
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to insert icon");
    } finally {
      setInserting(false);
    }
  }, [selected, color, onInsert, onOpenChange, reset]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shapes className="h-5 w-5" />
            Insert Icon
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            autoFocus
            placeholder="Search icons…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/40 pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        {/* Color presets */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground mr-1">Color</span>
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "h-5 w-5 rounded-full border transition-transform hover:scale-110",
                color === c ? "ring-2 ring-primary/60 border-primary/60" : "border-border",
              )}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-5 w-5 rounded border border-border p-0 cursor-pointer"
            title="Custom color"
          />
        </div>

        {/* Icon grid */}
        <div className="grid grid-cols-8 gap-1 max-h-72 overflow-auto rounded-lg border border-border bg-muted/20 p-2">
          {results.map((entry) => {
            const Icon = entry.Component;
            const isSelected = selected?.name === entry.name;
            return (
              <button
                key={entry.name}
                type="button"
                onClick={() => setSelected(entry)}
                title={entry.name}
                className={cn(
                  "flex items-center justify-center aspect-square rounded transition-colors",
                  isSelected
                    ? "bg-primary/15 ring-1 ring-primary/60"
                    : "hover:bg-muted",
                )}
              >
                <Icon className="h-5 w-5" style={{ color }} strokeWidth={1.75} />
              </button>
            );
          })}
          {results.length === 0 && (
            <div className="col-span-8 py-6 text-center text-xs text-muted-foreground">
              No icons match &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

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
          <Button onClick={handleInsert} disabled={!selected || inserting}>
            {inserting ? "Inserting…" : "Insert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
