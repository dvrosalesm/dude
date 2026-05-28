"use client";

import { memo } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { DeleteNodeButton } from "./delete-node-button";

interface ShapeData {
  shape?: "rectangle" | "ellipse" | "line" | "arrow" | "triangle";
  fill?: string;
  stroke?: string;
  borderWidth?: number;
  borderRadius?: number;
}

function ShapeNodeInner({ id, data, selected }: NodeProps) {
  const {
    shape = "rectangle",
    fill = "#ffffff",
    stroke = "#0f172a",
    borderWidth = 1.5,
    borderRadius = 6,
  } = (data || {}) as ShapeData;

  let shapeEl: React.ReactNode;
  switch (shape) {
    case "ellipse":
      shapeEl = (
        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
          <ellipse cx="50" cy="50" rx="48" ry="48" fill={fill} stroke={stroke} strokeWidth={borderWidth} />
        </svg>
      );
      break;
    case "line":
      shapeEl = (
        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
          <line x1="2" y1="50" x2="98" y2="50" stroke={stroke} strokeWidth={borderWidth} />
        </svg>
      );
      break;
    case "arrow":
      shapeEl = (
        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
          <line x1="2" y1="50" x2="92" y2="50" stroke={stroke} strokeWidth={borderWidth} />
          <polygon points="92,42 100,50 92,58" fill={stroke} />
        </svg>
      );
      break;
    case "triangle":
      shapeEl = (
        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
          <polygon points="50,4 96,96 4,96" fill={fill} stroke={stroke} strokeWidth={borderWidth} />
        </svg>
      );
      break;
    default:
      shapeEl = (
        <div
          className="h-full w-full"
          style={{
            background: fill,
            border: `${borderWidth}px solid ${stroke}`,
            borderRadius,
          }}
        />
      );
  }

  return (
    <div className="relative h-full w-full group/shape-node">
      <NodeResizer
        isVisible={selected}
        minWidth={40}
        minHeight={40}
        lineClassName="!border-foreground/20"
        handleClassName="!bg-foreground/40 !border-background"
      />
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      {shapeEl}
      <div
        className={`absolute left-full top-0 ml-2 z-10 flex flex-col items-start gap-1.5 transition-opacity ${
          selected
            ? "opacity-100"
            : "opacity-0 group-hover/shape-node:opacity-100"
        }`}
      >
        <DeleteNodeButton id={id} />
      </div>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

export const ShapeNode = memo(ShapeNodeInner);
