"use client";

import { memo } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { CanvasNodeRefHandle } from "./canvas-ref-handle";
import { DeleteNodeButton } from "./delete-node-button";
import { DownloadNodeButton } from "./download-node-button";
import {
  downloadFromUrl,
  guessImageExtension,
  slugifyForFilename,
} from "./download-helpers";

interface LogoData {
  name?: string;
  brief?: string;
  imageUrl?: string;
  rationale?: string;
}

function LogoConceptNodeInner({ id, data, selected }: NodeProps) {
  const { name = "Logo concept", brief = "", imageUrl = "", rationale = "" } =
    (data || {}) as LogoData;

  const refContent = [
    `[Canvas reference — logo concept]`,
    `Name: ${name}`,
    imageUrl ? `URL: ${imageUrl}` : null,
    brief ? `Brief: ${brief}` : null,
    rationale ? `Rationale: ${rationale}` : null,
    imageUrl
      ? `\nUse this logo as a reference. Look at it directly, or call extract_image_colors with the URL above to derive its palette.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="relative h-full w-full group/logo-node">
      <NodeResizer
        isVisible={selected}
        minWidth={240}
        minHeight={260}
        lineClassName="!border-foreground/20"
        handleClassName="!bg-foreground/40 !border-background"
      />
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="absolute inset-0 rounded-xl bg-card shadow-sm border border-border/40 overflow-hidden flex flex-col">
        <div className="relative h-40 w-full bg-muted/40">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              No image
            </div>
          )}
        </div>
        <div className="px-3 py-2 flex-1 overflow-hidden">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Logo concept
          </p>
          <p className="text-sm font-semibold truncate">{name}</p>
          {brief && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {brief}
            </p>
          )}
          {rationale && (
            <p className="mt-1 text-xs text-foreground/70 line-clamp-3">
              {rationale}
            </p>
          )}
        </div>
      </div>
      <div
        className={`absolute left-full top-0 ml-2 z-10 flex flex-col items-start gap-1.5 transition-opacity ${
          selected
            ? "opacity-100"
            : "opacity-0 group-hover/logo-node:opacity-100"
        }`}
      >
        {imageUrl && (
          <DownloadNodeButton
            title="Download logo"
            onClick={() => {
              const ext = guessImageExtension(imageUrl);
              const base = slugifyForFilename(name, "logo");
              void downloadFromUrl(imageUrl, `${base}.${ext}`);
            }}
          />
        )}
        <CanvasNodeRefHandle
          id={id}
          type="logoConcept"
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

export const LogoConceptNode = memo(LogoConceptNodeInner);
