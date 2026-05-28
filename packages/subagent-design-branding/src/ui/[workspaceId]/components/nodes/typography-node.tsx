"use client";

import { memo } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import type { BrandTypographyFace } from "@dude/subagent-design-branding/lib/types";
import { CanvasNodeRefHandle } from "./canvas-ref-handle";
import { DeleteNodeButton } from "./delete-node-button";
import { DownloadNodeButton } from "./download-node-button";
import { downloadAsFile, slugifyForFilename } from "./download-helpers";

interface TypographyData {
  name?: string;
  display?: BrandTypographyFace;
  body?: BrandTypographyFace;
  sampleText?: string;
}

function TypographyNodeInner({ id, data, selected }: NodeProps) {
  const {
    name = "Typography",
    display = { family: "Geist Sans", weight: 700 },
    body = { family: "Geist Sans", weight: 400 },
    sampleText = "The quick brown fox jumps over the lazy dog",
  } = (data || {}) as TypographyData;

  const refContent = [
    `[Canvas reference — typography]`,
    `Name: ${name}`,
    `Display: ${display.family}${display.weight ? ` ${display.weight}` : ""}`,
    `Body: ${body.family}${body.weight ? ` ${body.weight}` : ""}`,
  ].join("\n");

  return (
    <div className="relative h-full w-full group/typography-node">
      <NodeResizer
        isVisible={selected}
        minWidth={260}
        minHeight={180}
        lineClassName="!border-foreground/20"
        handleClassName="!bg-foreground/40 !border-background"
      />
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="absolute inset-0 rounded-xl bg-card shadow-sm border border-border/40 px-4 py-3 overflow-hidden">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Typography
        </p>
        <p className="text-sm font-semibold mb-2 truncate">{name}</p>
        <div className="space-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Display · {display.family} {display.weight ? `· ${display.weight}` : ""}
            </p>
            <p
              className="text-2xl leading-tight"
              style={{
                fontFamily: `${display.family}, sans-serif`,
                fontWeight: display.weight as number | undefined,
              }}
            >
              {sampleText}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Body · {body.family} {body.weight ? `· ${body.weight}` : ""}
            </p>
            <p
              className="text-sm leading-snug"
              style={{
                fontFamily: `${body.family}, sans-serif`,
                fontWeight: body.weight as number | undefined,
              }}
            >
              {sampleText}
            </p>
          </div>
        </div>
      </div>
      <div
        className={`absolute left-full top-0 ml-2 z-10 flex flex-col items-start gap-1.5 transition-opacity ${
          selected
            ? "opacity-100"
            : "opacity-0 group-hover/typography-node:opacity-100"
        }`}
      >
        <DownloadNodeButton
          title="Download typography as JSON"
          onClick={() =>
            downloadAsFile(
              JSON.stringify({ name, display, body, sampleText }, null, 2),
              `${slugifyForFilename(name, "typography")}.json`,
              "application/json",
            )
          }
        />
        <CanvasNodeRefHandle
          id={id}
          type="typography"
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

export const TypographyNode = memo(TypographyNodeInner);
