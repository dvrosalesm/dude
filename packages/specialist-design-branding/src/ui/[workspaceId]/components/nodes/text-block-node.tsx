"use client";

import { memo, useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { CanvasNodeRefHandle } from "./canvas-ref-handle";
import { DeleteNodeButton } from "./delete-node-button";

interface TextData {
  text?: string;
  fontSize?: number;
  weight?: number | string;
  fontFamily?: string;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right" | "justify";
  bgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
}

function TextBlockNodeInner({ id, data, selected }: NodeProps) {
  const {
    text = "",
    fontSize = 16,
    weight = 500,
    fontFamily,
    textColor,
    bold,
    italic,
    align,
    bgColor,
    borderColor,
    borderWidth,
    borderRadius,
  } = (data || {}) as TextData;
  const textStyle: React.CSSProperties = {
    fontSize,
    fontWeight: bold ? 700 : (weight as number),
    fontStyle: italic ? "italic" : undefined,
    fontFamily,
    color: textColor,
    textAlign: align,
  };
  const containerStyle: React.CSSProperties = {
    background: bgColor,
    borderColor: borderColor,
    borderWidth: borderWidth,
    borderStyle: borderWidth ? "solid" : undefined,
    borderRadius: borderRadius,
  };
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  const refContent = `[Canvas reference — text block]\n${text || "(empty)"}`;

  function commit() {
    setEditing(false);
    if (draft === text) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, text: draft } } : n)),
    );
  }

  return (
    <div className="relative h-full w-full group/text-node">
      <NodeResizer
        isVisible={selected}
        minWidth={140}
        minHeight={60}
        lineClassName="!border-foreground/20"
        handleClassName="!bg-foreground/40 !border-background"
      />
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div
        className="absolute inset-0 rounded-lg bg-card shadow-sm border border-border/40 px-4 py-3 overflow-hidden"
        style={containerStyle}
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
            className="h-full w-full bg-transparent outline-none resize-none leading-snug"
            style={textStyle}
            placeholder="Type something..."
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => {
              setDraft(text);
              setEditing(true);
            }}
            className="h-full w-full whitespace-pre-wrap leading-snug"
            style={textStyle}
          >
            {text || <span className="text-foreground/40">Double-click to edit</span>}
          </button>
        )}
      </div>
      <div
        className={`absolute left-full top-0 ml-2 z-10 flex flex-col items-start gap-1.5 transition-opacity ${
          selected
            ? "opacity-100"
            : "opacity-0 group-hover/text-node:opacity-100"
        }`}
      >
        {text && (
          <CanvasNodeRefHandle
            id={id}
            type="textBlock"
            name={text.slice(0, 32) || "Text block"}
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

export const TextBlockNode = memo(TextBlockNodeInner);
