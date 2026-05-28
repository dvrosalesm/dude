"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Handle, NodeResizer, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { Sparkles, X } from "lucide-react";
import { CanvasNodeRefHandle } from "./canvas-ref-handle";
import { DeleteNodeButton } from "./delete-node-button";
import { DownloadNodeButton } from "./download-node-button";
import { slugifyForFilename } from "./download-helpers";
import { ImageExportDialog } from "@dude/subagent-design-branding/components/image-export-dialog";
import { LavaLampPattern } from "@dude/chat/subagents/lava-lamp-pattern";

interface ImageData {
  url?: string;
  alt?: string;
  /** True while the edit job is in flight; renders an animated placeholder. */
  pending?: boolean;
  /** Set if the edit job failed. */
  error?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
  maskTool?: "brush" | "erase" | null;
  maskBrushSize?: number;
  maskImage?: string;
  maskClearToken?: number;
}

function ImageNodeInner({ id, data, selected }: NodeProps) {
  const {
    url = "",
    alt = "Image",
    pending = false,
    error,
    borderColor,
    borderWidth = 0,
    borderRadius,
    opacity,
    maskTool = null,
    maskBrushSize = 44,
    maskImage,
    maskClearToken,
  } = (data || {}) as ImageData;
  const { deleteElements, setNodes } = useReactFlow();
  const [exportOpen, setExportOpen] = useState(false);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Inline cancel/dismiss for pending or failed placeholders. The floating
  // DeleteNodeButton outside the right edge is easy to miss while the
  // placeholder is animating — this gives users an obvious affordance to
  // remove an image that's stuck uploading or failed. Uses deleteElements so
  // the removal dispatches through onNodesChange and gets persisted.
  const removeNode = () => {
    void deleteElements({ nodes: [{ id }] });
  };

  const refContent = url
    ? `[Canvas reference — image]\nLabel: ${alt}\nURL: ${url}\n\nUse this image as a reference. Look at it directly, or call extract_image_colors with the URL above to derive a precise palette.`
    : `[Canvas reference — image]\nLabel: ${alt}\n(no URL set)`;
  const canDrawMask = selected && !pending && !error && Boolean(url) && Boolean(maskTool);

  useEffect(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!maskImage) return;
    const img = new window.Image();
    img.onload = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = maskImage;
  }, [maskImage, maskClearToken, selected, url]);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function drawMaskStroke(from: { x: number; y: number }, to: { x: number; y: number }) {
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !maskTool) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = maskBrushSize;
    ctx.globalCompositeOperation = maskTool === "erase" ? "destination-out" : "source-over";
    ctx.strokeStyle = "rgba(255, 64, 64, 0.8)";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  function saveMaskImage() {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const nextMaskImage = canvas.toDataURL("image/png");
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, maskImage: nextMaskImage } }
          : node,
      ),
    );
  }

  return (
    <div className="relative h-full w-full group/img-node">
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={80}
        keepAspectRatio
        lineClassName="!border-foreground/20"
        handleClassName="!bg-foreground/40 !border-background"
      />
      <Handle type="target" position={Position.Top} className="!opacity-0" />

      {/* Animated gradient frame around the card while a new image is being
          generated — matches the loader inside the image-edit modal. */}
      {pending && (
        <div
          className="ai-border-gradient pointer-events-none absolute -inset-1 rounded-[14px] opacity-90"
          aria-hidden
        />
      )}

      {/* Image card — bounded with overflow:hidden for rounded corners. */}
      <div
        className={`absolute inset-0 overflow-hidden bg-muted shadow-sm ${
          pending ? "ring-1 ring-white/60" : ""
        }`}
        style={{
          borderRadius: borderRadius ?? 8,
          border: borderWidth
            ? `${borderWidth}px solid ${borderColor ?? "#0f172a"}`
            : undefined,
          opacity,
        }}
      >
        {pending ? (
          <PendingImagePlaceholder id={id} alt={alt} />
        ) : error ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-3 text-center text-xs text-destructive">
            <span className="font-medium">Failed</span>
            <span className="text-[10px] text-muted-foreground line-clamp-3">{error}</span>
          </div>
        ) : url ? (
          <>
            <img
              src={url}
              alt={alt}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <canvas
              ref={maskCanvasRef}
              className={`nodrag absolute inset-0 h-full w-full ${
                canDrawMask ? "pointer-events-auto" : "pointer-events-none"
              }`}
              style={{
                cursor: canDrawMask
                  ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Ccircle cx='14' cy='14' r='11' fill='none' stroke='black' stroke-width='2'/%3E%3Ccircle cx='14' cy='14' r='2' fill='black'/%3E%3C/svg%3E") 14 14, crosshair`
                  : undefined,
              }}
              onPointerDown={(e) => {
                if (!canDrawMask) return;
                e.preventDefault();
                e.stopPropagation();
                drawingRef.current = true;
                const point = pointFromEvent(e);
                lastPointRef.current = point;
                drawMaskStroke(point, point);
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!drawingRef.current || !lastPointRef.current || !canDrawMask) return;
                e.preventDefault();
                e.stopPropagation();
                const point = pointFromEvent(e);
                drawMaskStroke(lastPointRef.current, point);
                lastPointRef.current = point;
              }}
              onPointerUp={(e) => {
                if (!drawingRef.current) return;
                e.preventDefault();
                e.stopPropagation();
                drawingRef.current = false;
                lastPointRef.current = null;
                saveMaskImage();
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              }}
              onPointerCancel={(e) => {
                drawingRef.current = false;
                lastPointRef.current = null;
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              }}
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No image URL
          </div>
        )}
      </div>

      {/* Inline dismiss button overlaid on the card while the image is in a
          transient state (uploading or failed). Easier to spot than the
          floating column to the right. */}
      {(pending || error) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            removeNode();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="nodrag absolute top-1.5 right-1.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/95 backdrop-blur text-foreground shadow-sm border border-border/50 transition-colors hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
          title={pending ? "Cancel upload" : "Remove"}
          aria-label={pending ? "Cancel upload" : "Remove"}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Floating action column — sits just outside the card's right edge.
          Hidden by default; appears on node hover or while selected. */}
      <div
        data-image-node-actions
        className={`absolute left-full top-0 z-[9001] flex flex-col items-start gap-1.5 pl-2 transition-opacity ${
          selected
            ? "opacity-100"
            : "opacity-0 group-hover/img-node:opacity-100"
        }`}
      >
        {!pending && url && (
          <>
            <DownloadNodeButton
              title="Download image"
              onClick={() => setExportOpen(true)}
            />
            <CanvasNodeRefHandle
              id={id}
              type="image"
              name={alt || "Image"}
              content={refContent}
              positionClass=""
              variant="pill"
            />
          </>
        )}
        <DeleteNodeButton id={id} />
      </div>

      <ImageExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        imageUrl={url || null}
        filenameBase={slugifyForFilename(alt || "image", "image")}
      />

      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

function PendingImagePlaceholder({ id, alt }: { id: string; alt: string }) {
  return (
    <div className="relative h-full w-full">
      <LavaLampPattern id={id} className="absolute inset-0 h-full w-full" />
      {/* Diagonal shimmer sweep on top of the lava-lamp blobs. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-image-pending-sweep" />
      </div>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center">
        <Sparkles className="h-4 w-4 text-foreground/60 animate-pulse" />
        <span className="text-[10px] font-medium text-foreground/70 px-3 line-clamp-2">
          {alt || "Generating…"}
        </span>
      </div>
    </div>
  );
}

export const ImageNode = memo(ImageNodeInner);
