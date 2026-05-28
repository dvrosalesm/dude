"use client";

import { useReactFlow } from "@xyflow/react";
import { Trash2 } from "lucide-react";

/**
 * Floating "Delete" pill rendered in a node's right-side action column.
 * Uses deleteElements (not setNodes) so the removal dispatches through
 * onNodesChange and the canvas's scheduleSave actually persists the delete.
 */
export function DeleteNodeButton({ id }: { id: string }) {
  const { deleteElements } = useReactFlow();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void deleteElements({ nodes: [{ id }] });
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="nodrag inline-flex items-center gap-1.5 rounded-full bg-background/95 backdrop-blur px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm border border-border/40 transition-colors hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive whitespace-nowrap"
      title="Delete node"
      aria-label="Delete node"
    >
      <Trash2 className="h-3 w-3" />
      Delete
    </button>
  );
}
