"use client";

import { memo, useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { DeleteNodeButton } from "./delete-node-button";

interface FrameData {
  label?: string;
  color?: string;
  borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "dotted";
  borderRadius?: number;
  bgColor?: string;
}

function FrameNodeInner({ id, data, selected }: NodeProps) {
  const {
    label = "Frame",
    color = "#E7C59A",
    borderWidth = 2,
    borderStyle = "dashed",
    borderRadius = 6,
    bgColor = "#ffffff",
  } = (data || {}) as FrameData;
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === label) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: trimmed } } : n)),
    );
  }

  return (
    <div
      className="relative h-full w-full group/frame-node"
      style={{
        borderColor: color,
        borderWidth,
        borderStyle,
        borderRadius,
        background: bgColor,
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={120}
        lineClassName="!border-foreground/20"
        handleClassName="!bg-foreground/40 !border-background"
      />
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div
        className="absolute -top-6 left-0 inline-flex items-center gap-1 rounded-t-md px-2 py-0.5 text-[11px] font-medium text-white"
        style={{ background: color }}
      >
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(label);
                setEditing(false);
              }
            }}
            className="bg-transparent text-white placeholder:text-white/60 outline-none w-32"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => {
              setDraft(label);
              setEditing(true);
            }}
          >
            {label}
          </button>
        )}
      </div>
      <div
        className={`absolute left-full top-0 ml-2 z-10 flex flex-col items-start gap-1.5 transition-opacity ${
          selected
            ? "opacity-100"
            : "opacity-0 group-hover/frame-node:opacity-100"
        }`}
      >
        <DeleteNodeButton id={id} />
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

export const FrameNode = memo(FrameNodeInner);
