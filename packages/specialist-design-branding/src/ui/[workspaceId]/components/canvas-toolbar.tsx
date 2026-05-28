"use client";

import { useRef, useState } from "react";
import {
  Frame,
  Image as ImageIcon,
  Palette,
  PenLine,
  Shapes,
  StickyNote,
  Type,
} from "lucide-react";
import { Button } from "@dude/ui/components/button";
import { Input } from "@dude/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@dude/ui/components/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@dude/ui/components/tooltip";
import type { DesignNodeType } from "@dude/specialist-design-branding/lib/types";

interface CanvasToolbarProps {
  onAddNode: (
    type: DesignNodeType,
    data: Record<string, unknown>,
    size?: { width?: number; height?: number },
  ) => void;
  onImportImageFiles: (files: File[]) => void;
}

const STICKY_COLORS = [
  { value: "#fef3c7", label: "Yellow" },
  { value: "#dcfce7", label: "Green" },
  { value: "#dbeafe", label: "Blue" },
  { value: "#fce7f3", label: "Pink" },
  { value: "#f3e8ff", label: "Purple" },
  { value: "#fed7aa", label: "Orange" },
];

const SHAPE_OPTIONS = [
  { value: "rectangle", label: "Rectangle" },
  { value: "ellipse", label: "Ellipse" },
  { value: "line", label: "Line" },
  { value: "arrow", label: "Arrow" },
  { value: "triangle", label: "Triangle" },
];

export function CanvasToolbar({ onAddNode, onImportImageFiles }: CanvasToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [paletteName, setPaletteName] = useState("New palette");
  const [paletteOpen, setPaletteOpen] = useState(false);

  function addSticky(color: string) {
    onAddNode("stickyNote", { text: "", color }, { width: 220, height: 180 });
  }

  function addText() {
    onAddNode("textBlock", { text: "Type something..." }, { width: 280, height: 120 });
  }

  function addShape(shape: string) {
    onAddNode(
      "shape",
      {
        shape,
        fill: "#ffffff",
        stroke: "#0f172a",
      },
      { width: 200, height: 140 },
    );
  }

  function addFrame() {
    onAddNode(
      "frame",
      { label: "Frame", color: "#E7C59A", bgColor: "#ffffff" },
      { width: 600, height: 400 },
    );
  }

  function handleImageFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length > 0) onImportImageFiles(files);
    // Reset so picking the same file twice still fires onChange.
    e.target.value = "";
  }

  function addPalette() {
    onAddNode(
      "palette",
      {
        name: paletteName.trim() || "New palette",
        colors: [
          { hex: "#E7C59A", name: "Accent", role: "primary" },
          { hex: "#0f172a", name: "Ink", role: "text" },
          { hex: "#f7f7f5", name: "Paper", role: "background" },
          { hex: "#10b981", name: "Success", role: "semantic" },
        ],
      },
      { width: 320, height: 220 },
    );
    setPaletteName("New palette");
    setPaletteOpen(false);
  }

  return (
    <div
      className="absolute z-10 left-1/2 top-3 -translate-x-1/2"
      style={{ pointerEvents: "auto" }}
    >
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/95 backdrop-blur-sm px-2 py-1.5 shadow-md">
          {/* Sticky note */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Add sticky note">
                    <StickyNote className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Sticky note</TooltipContent>
            </Tooltip>
            <PopoverContent side="bottom" align="center" className="w-56 p-2">
              <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
                Pick a color
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {STICKY_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => addSticky(c.value)}
                    className="h-12 rounded-md border border-border/40 hover:scale-[1.03] transition-transform"
                    style={{ background: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Text */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addText} aria-label="Add text">
                <Type className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Text</TooltipContent>
          </Tooltip>

          {/* Shape */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Add shape">
                    <Shapes className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Shape</TooltipContent>
            </Tooltip>
            <PopoverContent side="bottom" align="center" className="w-44 p-1.5">
              {SHAPE_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => addShape(s.value)}
                  className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Frame */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addFrame} aria-label="Add frame">
                <Frame className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Frame</TooltipContent>
          </Tooltip>

          {/* Image — opens the system file picker; selected files flow
              through the same import pipeline as paste/drop. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageFiles}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Add image"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Image</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Palette */}
          <Popover open={paletteOpen} onOpenChange={setPaletteOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Add palette">
                    <Palette className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Palette</TooltipContent>
            </Tooltip>
            <PopoverContent side="bottom" align="center" className="w-72 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Palette name
              </p>
              <Input
                value={paletteName}
                onChange={(e) => setPaletteName(e.target.value)}
                placeholder="New palette"
                className="h-8 text-sm"
              />
              <Button size="sm" className="w-full mt-2 h-8" onClick={addPalette}>
                Add palette
              </Button>
            </PopoverContent>
          </Popover>

          {/* Brand book section */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  onAddNode(
                    "brandBookSection",
                    {
                      section: "custom",
                      title: "New section",
                      body: "",
                    },
                    { width: 360, height: 240 },
                  )
                }
                aria-label="Add brand book section"
              >
                <PenLine className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Brand book section</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
