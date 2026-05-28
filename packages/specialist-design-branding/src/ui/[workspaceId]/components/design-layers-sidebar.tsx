"use client";

import { useMemo, type ReactNode } from "react";
import type { Node } from "@xyflow/react";
import {
  BookOpen,
  Box,
  ChevronDown,
  ChevronUp,
  Code2,
  FileText,
  Frame,
  Image as ImageIcon,
  Layers,
  MessageSquareText,
  Palette,
  Shapes,
  Square,
  StickyNote,
  Type,
} from "lucide-react";

type LayerTreeItem = {
  node: Node;
  children: Node[];
};

export type LayerMoveDirection = "up" | "down";

type DesignLayersSidebarProps = {
  nodes: Node[];
  selectedNodeId?: string | null;
  onSelectNode: (id: string) => void;
  onReorderNode: (id: string, direction: LayerMoveDirection) => void;
};

const NODE_LABELS: Record<string, string> = {
  stickyNote: "Sticky note",
  textBlock: "Text",
  shape: "Shape",
  frame: "Frame",
  image: "Image",
  palette: "Palette",
  typography: "Typography",
  logoConcept: "Logo",
  brandBookSection: "Brand book",
  designReview: "Review",
  tokensExport: "Tokens",
  htmlMockup: "HTML mockup",
};

function nodeName(node: Node): string {
  const data = (node.data || {}) as Record<string, unknown>;
  const name =
    typeof data.title === "string" ? data.title :
      typeof data.name === "string" ? data.name :
        typeof data.alt === "string" ? data.alt :
          typeof data.label === "string" ? data.label :
            typeof data.text === "string" ? data.text :
              "";
  const trimmed = name.trim();
  if (trimmed) return trimmed.length > 34 ? `${trimmed.slice(0, 33)}...` : trimmed;
  return NODE_LABELS[node.type ?? ""] ?? "Layer";
}

function nodeIcon(type?: string) {
  if (type === "frame") return <Frame className="h-3.5 w-3.5" />;
  if (type === "image") return <ImageIcon className="h-3.5 w-3.5" />;
  if (type === "textBlock") return <Type className="h-3.5 w-3.5" />;
  if (type === "stickyNote") return <StickyNote className="h-3.5 w-3.5" />;
  if (type === "shape") return <Shapes className="h-3.5 w-3.5" />;
  if (type === "palette") return <Palette className="h-3.5 w-3.5" />;
  if (type === "typography") return <Type className="h-3.5 w-3.5" />;
  if (type === "logoConcept") return <Square className="h-3.5 w-3.5" />;
  if (type === "brandBookSection") return <BookOpen className="h-3.5 w-3.5" />;
  if (type === "designReview") return <MessageSquareText className="h-3.5 w-3.5" />;
  if (type === "tokensExport") return <FileText className="h-3.5 w-3.5" />;
  if (type === "htmlMockup") return <Code2 className="h-3.5 w-3.5" />;
  return <Box className="h-3.5 w-3.5" />;
}

function buildLayerTree(nodes: Node[]): { frames: LayerTreeItem[]; loose: Node[] } {
  const persisted = nodes.filter((node) => {
    const data = (node.data || {}) as { pending?: boolean; error?: string };
    return !data.pending && !data.error;
  });
  const frames = persisted.filter((node) => node.type === "frame");
  const frameIds = new Set(frames.map((node) => node.id));
  const childrenByFrame = new Map<string, Node[]>();
  const loose: Node[] = [];

  for (const node of persisted) {
    if (node.type === "frame") continue;
    if (node.parentId && frameIds.has(node.parentId)) {
      childrenByFrame.set(node.parentId, [...(childrenByFrame.get(node.parentId) ?? []), node]);
    } else {
      loose.push(node);
    }
  }

  return {
    frames: frames.map((node) => ({
      node,
      children: childrenByFrame.get(node.id) ?? [],
    })),
    loose,
  };
}

export function DesignLayersSidebar({
  nodes,
  selectedNodeId,
  onSelectNode,
  onReorderNode,
}: DesignLayersSidebarProps) {
  const tree = useMemo(() => buildLayerTree(nodes), [nodes]);
  const hasLayers = tree.frames.length > 0 || tree.loose.length > 0;

  return (
    <aside className="absolute left-3 top-3 bottom-3 z-20 hidden w-64 flex-col overflow-hidden rounded-2xl bg-card shadow-md lg:flex">
      <div className="shrink-0 border-b border-border/40 px-4 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[11px] font-semibold text-foreground">Layers</p>
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
          Frames and subobjects
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {!hasLayers ? (
          <div className="px-2 py-8 text-center text-[11px] leading-4 text-muted-foreground">
            Canvas layers will appear here.
          </div>
        ) : (
          <div className="space-y-1">
            {tree.frames.map((item) => (
              <div key={item.node.id}>
                <LayerButton
                  node={item.node}
                  selected={item.node.id === selectedNodeId}
                  onSelect={onSelectNode}
                />
                {item.children.length > 0 && (
                  <div className="ml-4 border-l border-border/60 pl-1">
                    {[...item.children].reverse().map((child, index) => (
                      <LayerButton
                        key={child.id}
                        node={child}
                        selected={child.id === selectedNodeId}
                        onSelect={onSelectNode}
                        onReorder={onReorderNode}
                        canMoveUp={index > 0}
                        canMoveDown={index < item.children.length - 1}
                        child
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {tree.loose.length > 0 && (
              <div className="pt-1">
                <div className="px-2 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Canvas
                </div>
                {tree.loose.map((node) => (
                  <LayerButton
                    key={node.id}
                    node={node}
                    selected={node.id === selectedNodeId}
                    onSelect={onSelectNode}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function LayerButton({
  node,
  selected,
  onSelect,
  onReorder,
  canMoveUp = false,
  canMoveDown = false,
  child = false,
}: {
  node: Node;
  selected: boolean;
  onSelect: (id: string) => void;
  onReorder?: (id: string, direction: LayerMoveDirection) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  child?: boolean;
}) {
  return (
    <div
      className={`group flex h-8 w-full min-w-0 items-center rounded-md text-xs transition-colors ${
        selected
          ? "bg-muted text-foreground shadow-sm ring-1 ring-border"
          : "text-foreground hover:bg-muted"
      } ${child ? "my-0.5" : ""}`}
      title={nodeName(node)}
    >
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className="flex h-full min-w-0 flex-1 items-center gap-2 px-2 text-left"
      >
        <span className={`shrink-0 ${selected ? "text-foreground" : "text-muted-foreground"}`}>
          {nodeIcon(node.type)}
        </span>
        <span className="min-w-0 flex-1 truncate">{nodeName(node)}</span>
        <span className={`shrink-0 text-[9px] uppercase ${selected ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
          {NODE_LABELS[node.type ?? ""] ?? node.type ?? "Node"}
        </span>
      </button>
      {onReorder ? (
        <div className={`flex h-full shrink-0 items-center border-l border-border/20 pr-1 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${selected ? "opacity-100" : "opacity-0"}`}>
          <MoveLayerButton
            label="Move layer up"
            disabled={!canMoveUp}
            selected={selected}
            onClick={() => onReorder(node.id, "up")}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </MoveLayerButton>
          <MoveLayerButton
            label="Move layer down"
            disabled={!canMoveDown}
            selected={selected}
            onClick={() => onReorder(node.id, "down")}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </MoveLayerButton>
        </div>
      ) : null}
    </div>
  );
}

function MoveLayerButton({
  label,
  disabled,
  selected,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`grid h-6 w-5 place-items-center rounded-sm transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${
        selected
          ? "text-muted-foreground hover:bg-background"
          : "text-muted-foreground hover:bg-background"
      }`}
    >
      {children}
    </button>
  );
}
