"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  Slide,
  PptxShapeTransform,
  PptxSlideDimensions,
} from "@dude/presentation-editor/types";
import type { SelectedShapeId } from "@dude/presentation-editor/store";
import { ShapeElement } from "./shape-element";

type SlideCanvasProps = {
  slide: Slide;
  slideDimensions: PptxSlideDimensions;
  selectedShapeId: SelectedShapeId;
  localShapeOverrides: Map<string, PptxShapeTransform>;
  onShapeSelect: (shapeIndex: number) => void;
  onClearSelection: () => void;
  onShapeDragEnd: (shapeIndex: number, transform: PptxShapeTransform) => void;
  onLocalDrag: (shapeIndex: number, transform: PptxShapeTransform) => void;
  onDeleteShape?: (shapeIndex: number) => void;
  onReorderShape?: (fromArrayIdx: number, toArrayIdx: number) => void;
  onHtmlUpdate?: (shapeIndex: number, htmlContent: string) => void;
  onDuplicateShape?: (shapeIndex: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
};

export function SlideCanvas({
  slide,
  slideDimensions,
  selectedShapeId,
  localShapeOverrides,
  onShapeSelect,
  onClearSelection,
  onShapeDragEnd,
  onLocalDrag,
  onDeleteShape,
  onReorderShape,
  onHtmlUpdate,
  onDuplicateShape,
  onUndo,
  onRedo,
}: SlideCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const shapes = (slide.shapes || []).filter((shape) => shape.type === "html" || shape.type === "shader");

  // Auto-focus the canvas so paste events work immediately
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      // Only deselect if clicking on the container itself (not a shape)
      if (e.target === containerRef.current) {
        onClearSelection();
      }
    },
    [onClearSelection],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (e.key === "Escape") {
        onClearSelection();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedShapeId) {
        e.preventDefault();
        onDeleteShape?.(selectedShapeId.shapeIndex);
        return;
      }
      // Undo: Cmd+Z
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        onUndo?.();
        return;
      }
      // Redo: Cmd+Shift+Z or Cmd+Y
      if ((mod && e.key === "z" && e.shiftKey) || (mod && e.key === "y")) {
        e.preventDefault();
        onRedo?.();
        return;
      }
      // Duplicate shape: Cmd+D
      if (mod && e.key === "d" && selectedShapeId) {
        e.preventDefault();
        onDuplicateShape?.(selectedShapeId.shapeIndex);
        return;
      }
      // Arrow key nudge
      const NUDGE = e.shiftKey ? 914400 / 4 : 914400 / 16; // ~0.25" with shift, ~1/16" without
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && selectedShapeId) {
        e.preventDefault();
        const shape = shapes.find((s) => s.shapeIndex === selectedShapeId.shapeIndex);
        if (!shape) return;
        const t = shape.transform;
        let { x, y } = t;
        if (e.key === "ArrowLeft") x = Math.max(0, x - NUDGE);
        if (e.key === "ArrowRight") x += NUDGE;
        if (e.key === "ArrowUp") y = Math.max(0, y - NUDGE);
        if (e.key === "ArrowDown") y += NUDGE;
        onShapeDragEnd(selectedShapeId.shapeIndex, { ...x, y });
        return;
      }
    },
    [onClearSelection, selectedShapeId, onDeleteShape, onUndo, onRedo, onDuplicateShape, shapes, onShapeDragEnd],
  );

  const handleMoveLayer = useCallback(
    (arrayIdx: number, direction: "forward" | "backward" | "front" | "back") => {
      if (!onReorderShape) return;
      const lastIdx = shapes.length - 1;

      let targetIdx: number;
      switch (direction) {
        case "forward":
          targetIdx = Math.min(arrayIdx + 1, lastIdx);
          break;
        case "backward":
          targetIdx = Math.max(arrayIdx - 1, 0);
          break;
        case "front":
          targetIdx = lastIdx;
          break;
        case "back":
          targetIdx = 0;
          break;
      }

      if (targetIdx !== arrayIdx) {
        onReorderShape(arrayIdx, targetIdx);
      }
    },
    [onReorderShape, shapes.length],
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full mx-auto border rounded-lg overflow-hidden shadow-lg"
      style={{
        aspectRatio: `${slideDimensions.width} / ${slideDimensions.height}`,
        maxWidth: "100%",
        background: slide.background || "#FFFFFF",
        containerType: "inline-size",
      }}
      onClick={handleContainerClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Snap guides — show when a shape is near slide center */}
      {(() => {
        if (!selectedShapeId) return null;
        const shape = shapes.find((s) => s.shapeIndex === selectedShapeId.shapeIndex);
        if (!shape) return null;
        const overrideKey = `${slide.index}:${shape.shapeIndex}`;
        const t = localShapeOverrides.get(overrideKey) || shape.transform;
        const sw = slideDimensions.width;
        const sh = slideDimensions.height;
        const centerX = t.x + t.cx / 2;
        const centerY = t.y + t.cy / 2;
        const SNAP = sw * 0.01; // 1% tolerance
        const showVCenter = Math.abs(centerX - sw / 2) < SNAP;
        const showHCenter = Math.abs(centerY - sh / 2) < SNAP;
        return (
          <>
            {showVCenter && <div className="absolute top-0 bottom-0 w-px bg-blue-400/50 z-[100] pointer-events-none" style={{ left: "50%" }} />}
            {showHCenter && <div className="absolute left-0 right-0 h-px bg-blue-400/50 z-[100] pointer-events-none" style={{ top: "50%" }} />}
          </>
        );
      })()}

      {shapes.map((shape, arrayIdx) => {
        if (shape.hidden) return null;
        const overrideKey = `${slide.index}:${shape.shapeIndex}`;
        const localTransform = localShapeOverrides.get(overrideKey);
        const isSelected =
          selectedShapeId?.slideIndex === slide.index &&
          selectedShapeId?.shapeIndex === shape.shapeIndex;

        return (
          <ShapeElement
            key={`shape-${shape.shapeIndex}`}
            shape={shape}
            slideDimensions={slideDimensions}
            isSelected={isSelected}
            localTransform={localTransform}
            zIndex={arrayIdx + 1}
            canMoveForward={arrayIdx < shapes.length - 1}
            canMoveBackward={arrayIdx > 0}
            onSelect={() => onShapeSelect(shape.shapeIndex)}
            onDragEnd={(transform) => onShapeDragEnd(shape.shapeIndex, transform)}
            onLocalDrag={(transform) => onLocalDrag(shape.shapeIndex, transform)}
            onMoveLayer={(direction) => handleMoveLayer(arrayIdx, direction)}
            onDeleteShape={() => onDeleteShape?.(shape.shapeIndex)}
            onHtmlUpdate={onHtmlUpdate ? (html) => onHtmlUpdate(shape.shapeIndex, html) : undefined}
          />
        );
      })}
    </div>
  );
}
