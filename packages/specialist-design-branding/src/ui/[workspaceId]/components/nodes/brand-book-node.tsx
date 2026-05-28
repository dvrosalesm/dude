"use client";

import { memo, useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { CanvasNodeRefHandle } from "./canvas-ref-handle";
import { DeleteNodeButton } from "./delete-node-button";

interface BrandBookData {
  section?: string;
  title?: string;
  body?: string;
}

const SECTION_LABELS: Record<string, string> = {
  mission: "Mission",
  audience: "Audience",
  voice: "Voice",
  principles: "Principles",
  logoUsage: "Logo Usage",
  doDont: "Do / Don't",
  custom: "Section",
};

function BrandBookNodeInner({ id, data, selected }: NodeProps) {
  const { section = "custom", title = "Section", body = "" } = (data || {}) as BrandBookData;
  const sectionLabel = SECTION_LABELS[section] || section;
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState<"title" | "body" | null>(null);
  const [titleDraft, setTitleDraft] = useState(title);
  const [bodyDraft, setBodyDraft] = useState(body);

  function commitTitle() {
    setEditing(null);
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === title) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, title: trimmed } } : n)),
    );
  }

  function commitBody() {
    setEditing(null);
    if (bodyDraft === body) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, body: bodyDraft } } : n)),
    );
  }

  const refContent = `[Canvas reference — brand book section]\nSection: ${sectionLabel}\nTitle: ${title}\n\n${body || "(empty body)"}`;

  return (
    <div className="relative h-full w-full group/brandbook-node">
      <NodeResizer
        isVisible={selected}
        minWidth={260}
        minHeight={180}
        lineClassName="!border-foreground/20"
        handleClassName="!bg-foreground/40 !border-background"
      />
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="absolute inset-0 rounded-xl bg-card shadow-sm border border-border/40 px-4 py-3 overflow-hidden flex flex-col">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        Brand book · {sectionLabel}
      </p>
      {editing === "title" ? (
        <input
          autoFocus
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitTitle();
            if (e.key === "Escape") {
              setTitleDraft(title);
              setEditing(null);
            }
          }}
          className="text-base font-semibold outline-none border-b border-border/40 mb-1"
        />
      ) : (
        <button
          type="button"
          onDoubleClick={() => {
            setTitleDraft(title);
            setEditing("title");
          }}
          className="text-base font-semibold text-left mb-1"
        >
          {title}
        </button>
      )}
      {editing === "body" ? (
        <textarea
          autoFocus
          value={bodyDraft}
          onChange={(e) => setBodyDraft(e.target.value)}
          onBlur={commitBody}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setBodyDraft(body);
              setEditing(null);
            }
          }}
          className="flex-1 text-sm leading-snug bg-transparent outline-none resize-none"
        />
      ) : (
        <button
          type="button"
          onDoubleClick={() => {
            setBodyDraft(body);
            setEditing("body");
          }}
          className="flex-1 text-sm text-left whitespace-pre-wrap text-foreground/80 leading-snug overflow-y-auto"
        >
          {body || (
            <span className="text-foreground/40">Double-click to edit</span>
          )}
        </button>
      )}
      </div>
      <div
        className={`absolute left-full top-0 ml-2 z-10 flex flex-col items-start gap-1.5 transition-opacity ${
          selected
            ? "opacity-100"
            : "opacity-0 group-hover/brandbook-node:opacity-100"
        }`}
      >
        <CanvasNodeRefHandle
          id={id}
          type="brandBookSection"
          name={`${sectionLabel}: ${title}`}
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

export const BrandBookNode = memo(BrandBookNodeInner);
