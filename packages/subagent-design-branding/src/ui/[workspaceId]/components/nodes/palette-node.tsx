"use client";

import { memo, useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { Check, Copy } from "lucide-react";
import type { BrandPaletteColor } from "@dude/subagent-design-branding/lib/types";
import { CanvasNodeRefHandle } from "./canvas-ref-handle";
import { DeleteNodeButton } from "./delete-node-button";
import { DownloadNodeButton } from "./download-node-button";
import { downloadAsFile, slugifyForFilename } from "./download-helpers";

interface PaletteData {
  name?: string;
  colors?: BrandPaletteColor[];
}

function PaletteNodeInner({ id, data, selected }: NodeProps) {
  const { name = "Palette", colors = [] } = (data || {}) as PaletteData;
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  function copy(hex: string) {
    navigator.clipboard?.writeText(hex).catch(() => {});
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex((prev) => (prev === hex ? null : prev)), 1200);
  }

  const refContent = [
    `[Canvas reference — palette]`,
    `Name: ${name}`,
    colors.length ? "Colors:" : "(no swatches)",
    ...colors.map(
      (c) =>
        `- ${c.hex}${c.name ? ` (${c.name})` : ""}${c.role ? ` — role: ${c.role}` : ""}`,
    ),
  ].join("\n");

  return (
    <div className="relative h-full w-full group/palette-node">
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        minHeight={180}
        lineClassName="!border-foreground/20"
        handleClassName="!bg-foreground/40 !border-background"
      />
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="absolute inset-0 rounded-xl bg-card shadow-sm border border-border/40 overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b border-border/40">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Palette
          </p>
          <p className="text-sm font-semibold truncate">{name}</p>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-1 p-2 overflow-y-auto">
          {colors.map((color, idx) => (
            <button
              key={`${color.hex}-${idx}`}
              type="button"
              onClick={() => copy(color.hex)}
              className="group relative flex flex-col items-stretch rounded-md overflow-hidden border border-border/30 hover:border-foreground/30 transition-colors"
              title={`${color.name || ""} ${color.hex}`}
            >
              <div className="h-10 w-full" style={{ background: color.hex }} />
              <div className="px-2 py-1 bg-card text-left">
                {color.name && (
                  <p className="text-[11px] font-medium leading-tight truncate">
                    {color.name}
                  </p>
                )}
                <p className="text-[10px] font-mono text-muted-foreground leading-tight">
                  {color.hex}
                </p>
              </div>
              <span className="absolute right-1 top-1 rounded bg-background/80 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {copiedHex === color.hex ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground" />
                )}
              </span>
            </button>
          ))}
          {!colors.length && (
            <p className="col-span-2 text-xs text-muted-foreground text-center py-6">
              No swatches yet
            </p>
          )}
        </div>
      </div>
      <div
        className={`absolute left-full top-0 ml-2 z-10 flex flex-col items-start gap-1.5 transition-opacity ${
          selected
            ? "opacity-100"
            : "opacity-0 group-hover/palette-node:opacity-100"
        }`}
      >
        {colors.length > 0 && (
          <DownloadNodeButton
            title="Download palette as JSON"
            onClick={() =>
              downloadAsFile(
                JSON.stringify({ name, colors }, null, 2),
                `${slugifyForFilename(name, "palette")}.json`,
                "application/json",
              )
            }
          />
        )}
        <CanvasNodeRefHandle
          id={id}
          type="palette"
          name={name}
          content={refContent}
          positionClass=""
          variant="pill"
        />
        <DeleteNodeButton id={id} />
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

export const PaletteNode = memo(PaletteNodeInner);
