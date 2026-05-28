"use client";

import { memo, useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { CanvasNodeRefHandle } from "./canvas-ref-handle";
import { DeleteNodeButton } from "./delete-node-button";

interface StickyData {
  text?: string;
  color?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right" | "justify";
}

function StickyNoteNodeInner({ id, data, selected }: NodeProps) {
  const {
    text = "",
    color = "#fef3c7",
    textColor,
    fontFamily,
    fontSize,
    bold,
    italic,
    align,
  } = (data || {}) as StickyData;
  const textStyle: React.CSSProperties = {
    color: textColor,
    fontFamily,
    fontSize,
    fontWeight: bold ? 700 : undefined,
    fontStyle: italic ? "italic" : undefined,
    textAlign: align,
  };
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  const refContent = `[Canvas reference — sticky note]\n${text || "(empty)"}`;

  function commit() {
    setEditing(false);
    if (draft === text) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, text: draft } } : n)),
    );
  }

  return (
    <div className="relative h-full w-full group/sticky-node">
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={120}
        lineClassName="!border-foreground/20"
        handleClassName="!bg-foreground/40 !border-background"
      />
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div
        className="absolute inset-0 rounded-md shadow-md p-3 text-sm leading-snug text-foreground/90 overflow-hidden"
        style={{ background: color }}
      >
        {editing ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft(text);
                setEditing(false);
              }
            }}
            className="h-full w-full bg-transparent outline-none resize-none text-sm leading-snug"
            placeholder="Type here..."
            style={textStyle}
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => {
              setDraft(text);
              setEditing(true);
            }}
            className="h-full w-full whitespace-pre-wrap"
            style={textStyle}
          >
            {text || (
              <span className="text-foreground/40">Double-click to edit</span>
            )}
          </button>
        )}
      </div>
      <div
        className={`absolute left-full top-0 ml-2 z-10 flex flex-col items-start gap-1.5 transition-opacity ${
          selected
            ? "opacity-100"
            : "opacity-0 group-hover/sticky-node:opacity-100"
        }`}
      >
        {text && (
          <CanvasNodeRefHandle
            id={id}
            type="stickyNote"
            name={text.slice(0, 32) || "Sticky note"}
            content={refContent}
            positionClass=""
            variant="pill"
          />
        )}
        <DeleteNodeButton id={id} />
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

export const StickyNoteNode = memo(StickyNoteNodeInner);
