"use client";

import type React from "react";
import { Input } from "@dude/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@dude/ui/components/popover";

export const COLOR_PRESETS = [
  "#000000", "#ffffff", "#404040", "#808080", "#c0c0c0",
  "#ef4444", "#f97316", "#facc15", "#22c55e", "#0ea5e9",
  "#7c3aed", "#ec4899", "#E7C59A", "#fef3c7", "#dcfce7",
  "#dbeafe", "#fce7f3", "#f3e8ff", "#fed7aa", "#0f172a",
];

export const FONT_FAMILIES = [
  "Geist Sans",
  "Inter",
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Geist Mono",
];

export const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80];

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-3 border-b border-border/50 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function NumberRow({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-12 shrink-0">{label}</span>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isFinite(v)) return;
          onChange(v);
        }}
        className="h-7 text-xs"
      />
    </label>
  );
}

export function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit?: string;
}) {
  return (
    <label className="block space-y-1.5 text-xs">
      <span className="flex items-center justify-between gap-2 text-muted-foreground">
        <span>{label}</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
          {Math.round(value)}{unit}
        </span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full accent-foreground"
      />
    </label>
  );
}

export function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-12 shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 flex-1 rounded-md border border-border/60 bg-background px-2 text-xs"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ColorRow({
  label,
  value,
  onChange,
  showTransparent = false,
}: {
  label: string;
  value: string;
  onChange: (c: string) => void;
  showTransparent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-12 shrink-0">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-7 w-7 rounded-md border border-border/60 shadow-sm shrink-0"
            style={
              value === "transparent"
                ? {
                    background:
                      "repeating-conic-gradient(#d4d4d4 0% 25%, #ffffff 0% 50%) 50% / 8px 8px",
                  }
                : { background: value }
            }
            aria-label={`${label} color`}
          />
        </PopoverTrigger>
        <PopoverContent side="left" align="start" className="w-auto p-2">
          <div className="grid grid-cols-5 gap-1.5">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                className="h-6 w-6 rounded border border-border/40 hover:scale-110 transition-transform"
                style={{ background: c }}
                aria-label={c}
              />
            ))}
            {showTransparent && (
              <button
                type="button"
                onClick={() => onChange("transparent")}
                className="h-6 w-6 rounded border border-border/40 hover:scale-110 transition-transform"
                style={{
                  background:
                    "repeating-conic-gradient(#d4d4d4 0% 25%, #ffffff 0% 50%) 50% / 6px 6px",
                }}
                aria-label="Transparent"
              />
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="color"
              value={value === "transparent" ? "#ffffff" : value}
              onChange={(e) => onChange(e.target.value)}
              className="h-7 w-9 cursor-pointer rounded border border-border/40"
            />
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="h-7 text-xs flex-1"
            />
          </div>
        </PopoverContent>
      </Popover>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-xs flex-1"
      />
    </div>
  );
}

export function ToggleButton({
  active,
  onClick,
  children,
  ...rest
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
        active
          ? "bg-primary/10 border-primary/40 text-primary"
          : "bg-transparent border-border/50 text-foreground/70 hover:bg-accent"
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function defaultFill(type: string): string {
  if (type === "shape") return "#ffffff";
  if (type === "stickyNote") return "#fef3c7";
  if (type === "frame") return "#ffffff";
  if (type === "textBlock") return "#ffffff";
  return "#ffffff";
}
