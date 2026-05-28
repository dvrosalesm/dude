"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2 } from "lucide-react";
import type {
  PptxContent,
  PptxShapeTransform,
} from "@dude/presentation-editor/types";
import type { SelectedShapeId } from "@dude/presentation-editor/store";
import { cn } from "@dude/ui/utils";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import { SlideCanvas } from "./slide-canvas";

type PptxPreviewProps = {
  content: PptxContent;
  className?: string;
  changedSlideIndices?: Set<number>;
  onHtmlReady?: (html: string) => void;
  // Always-on edit props
  editingSlideIndex: number;
  selectedShapeId?: SelectedShapeId;
  localShapeOverrides?: Map<string, PptxShapeTransform>;
  onShapeSelect?: (slideIndex: number, shapeIndex: number) => void;
  onClearShapeSelection?: () => void;
  onShapeDragEnd?: (slideIndex: number, shapeIndex: number, transform: PptxShapeTransform) => void;
  onLocalDrag?: (slideIndex: number, shapeIndex: number, transform: PptxShapeTransform) => void;
  onDeleteShape?: (slideIndex: number, shapeIndex: number) => void;
  onReorderShape?: (slideIndex: number, fromArrayIdx: number, toArrayIdx: number) => void;
  onHtmlUpdate?: (slideIndex: number, shapeIndex: number, htmlContent: string) => void;
  onContentUpdate?: (content: PptxContent) => void;
  onDuplicateShape?: (slideIndex: number, shapeIndex: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  agentWorking?: boolean;
};

export function PptxPreview({
  content,
  className,
  editingSlideIndex,
  selectedShapeId,
  localShapeOverrides,
  onShapeSelect,
  onClearShapeSelection,
  onShapeDragEnd,
  onLocalDrag,
  onDeleteShape,
  onReorderShape,
  onHtmlUpdate,
  onHtmlReady,
  onDuplicateShape,
  onUndo,
  onRedo,
  agentWorking,
}: PptxPreviewProps) {
  const slides = useMemo(() => content.slides ?? [], [content.slides]);
  const dims = content.slideDimensions || { width: 12192000, height: 6858000 };
  const slide = slides[editingSlideIndex];

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [userZoom, setUserZoom] = useState(1);
  const editorScale = fitScale * userZoom;

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const REF_W = 960;
    const refH = (dims.height / dims.width) * REF_W;
    const PAD_X = 48;
    const PAD_TOP = 24;
    const PAD_BOTTOM = 130;

    function update() {
      const rect = el!.getBoundingClientRect();
      const availW = rect.width - PAD_X * 2;
      const availH = rect.height - PAD_TOP - PAD_BOTTOM;
      if (availW <= 0 || availH <= 0) return;
      setFitScale(Math.min(availW / REF_W, availH / refH, 1));
    }
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dims.width, dims.height]);

  // Keyboard zoom: Cmd+= / Cmd+- / Cmd+0
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setUserZoom((z) => Math.min(z + 0.1, 2));
      } else if (e.key === "-") {
        e.preventDefault();
        setUserZoom((z) => Math.max(z - 0.1, 0.3));
      } else if (e.key === "0") {
        e.preventDefault();
        setUserZoom(1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Generate presentation HTML for presenter mode
  useEffect(() => {
    if (!slides.length || !onHtmlReady) return;
    const parts: string[] = [];
    for (const s of slides) {
      parts.push(`<div class="pptx-slide" data-slide-index="${s.index}" style="position:relative;background:${s.background || "#fff"};aspect-ratio:${dims.width}/${dims.height};overflow:hidden;">`);
      for (const shape of (s.shapes || []).filter((item) => item.type === "html" || item.type === "shader")) {
        const left = ((shape.transform.x / dims.width) * 100).toFixed(4);
        const top = ((shape.transform.y / dims.height) * 100).toFixed(4);
        const w = ((shape.transform.cx / dims.width) * 100).toFixed(4);
        const h = ((shape.transform.cy / dims.height) * 100).toFixed(4);
        const fill = shape.fill?.type === "solid" ? `background:${shape.fill.color};` : "";
        const base = `position:absolute;left:${left}%;top:${top}%;width:${w}%;height:${h}%;z-index:${shape.shapeIndex};overflow:hidden;${fill}`;
        if (shape.type === "html") {
          const srcDoc = shape.htmlContent
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          parts.push(`<iframe srcdoc="${srcDoc}" sandbox="allow-scripts" style="${base}border:0"></iframe>`);
        } else if (shape.type === "shader") {
          parts.push(`<div style="${base}"></div>`);
        }
      }
      parts.push("</div>");
    }
    onHtmlReady(parts.join(""));
  }, [dims.height, dims.width, onHtmlReady, slides]);

  if (!slides.length) {
    return (
      <div className={cn("p-6 text-sm text-muted-foreground flex items-center justify-center", className)}>
        {"No slides in presentation"}
      </div>
    );
  }

  if (!slide) {
    return (
      <div className={cn("p-6 flex items-center justify-center", className)}>
        <BrailleSpinner className="text-3xl text-primary" />
      </div>
    );
  }

  // Render at a fixed reference width (matching presentation mode) so that
  // iframe-based HTML shapes resolve CSS units identically in both views.
  const REFERENCE_WIDTH = 960;
  const refHeight = (dims.height / dims.width) * REFERENCE_WIDTH;

  return (
    <div className={cn("flex-1 min-h-0 relative overflow-hidden", className)}>
    <div
      ref={wrapperRef}
      className={cn("absolute inset-0 flex items-center justify-center", userZoom > 1 ? "overflow-auto" : "overflow-hidden")}
    >
      <div
        style={{
          width: REFERENCE_WIDTH,
          height: refHeight,
          transform: `scale(${editorScale})`,
          transformOrigin: "center center",
          flexShrink: 0,
          marginBottom: 130,
          position: "relative",
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%", isolation: "isolate", pointerEvents: agentWorking ? "none" : undefined }}>
        <SlideCanvas
          slide={slide}
          slideDimensions={dims}
          selectedShapeId={selectedShapeId ?? null}
          localShapeOverrides={localShapeOverrides ?? new Map()}
          onShapeSelect={(shapeIndex) => onShapeSelect?.(editingSlideIndex, shapeIndex)}
          onClearSelection={() => onClearShapeSelection?.()}
          onShapeDragEnd={(shapeIndex, transform) => onShapeDragEnd?.(editingSlideIndex, shapeIndex, transform)}
          onLocalDrag={(shapeIndex, transform) => onLocalDrag?.(editingSlideIndex, shapeIndex, transform)}
          onDeleteShape={(shapeIndex) => onDeleteShape?.(editingSlideIndex, shapeIndex)}
          onReorderShape={(fromIdx, toIdx) => onReorderShape?.(editingSlideIndex, fromIdx, toIdx)}
          onHtmlUpdate={(shapeIndex, html) => onHtmlUpdate?.(editingSlideIndex, shapeIndex, html)}
          onDuplicateShape={(shapeIndex) => onDuplicateShape?.(editingSlideIndex, shapeIndex)}
          onUndo={onUndo}
          onRedo={onRedo}
        />
        {/* Lava lamp overlay — inside the isolation wrapper so it sits above the iframe */}
        <AnimatePresence>
          {agentWorking && (
            <motion.div
              key="lava-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              style={{ position: "absolute", inset: 0, borderRadius: 8, zIndex: 999, pointerEvents: "none", overflow: "hidden" }}
            >
              <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)" }} />
              <div className="lava-blob lava-1" />
              <div className="lava-blob lava-2" />
              <div className="lava-blob lava-3" />
              <div className="lava-blob lava-4" />
              <div className="lava-blob lava-5" />
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </div>

    {/* Glow border — box-shadow + hue-rotate */}
    <AnimatePresence>
    {agentWorking && (
    <motion.div
      key="slide-glow-overlay"
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
      style={{ zIndex: 10 }}
    >
      <div
        className="ai-generation-glow"
        style={{
          width: REFERENCE_WIDTH * editorScale,
          height: refHeight * editorScale,
          // Must match the slide's unscaled 130px marginBottom so both boxes
          // share the same flex-center offset; using 130 * editorScale here
          // would center the glow at a different Y than the slide.
          marginBottom: 130,
          borderRadius: 8,
        }}
      />
    </motion.div>
    )}
    </AnimatePresence>


    {/* Zoom controls — outside scrollable area so they stay fixed */}
    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg px-1.5 py-0.5 shadow-sm z-20">
      <button
        type="button"
        onClick={() => setUserZoom((z) => Math.max(z - 0.1, 0.3))}
        className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors text-sm font-medium"
      >
        −
      </button>
      <button
        type="button"
        onClick={() => setUserZoom(1)}
        className="px-1.5 h-6 flex items-center justify-center text-[10px] font-mono text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors min-w-[36px]"
      >
        {Math.round(userZoom * 100)}%
      </button>
      <button
        type="button"
        onClick={() => setUserZoom((z) => Math.min(z + 0.1, 2))}
        className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors text-sm font-medium"
      >
        +
      </button>
      <span className="mx-0.5 h-4 w-px bg-gray-200" />
      <button
        type="button"
        onClick={() => setUserZoom(1)}
        title="Fit to screen"
        aria-label="Fit to screen"
        className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
      >
        <Maximize2 className="h-3 w-3" />
      </button>
    </div>
    </div>
  );
}
