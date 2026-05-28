"use client";

import type { Node } from "@xyflow/react";
import { ImageOperationsSection } from "./design-sidebar-image-operations";
import {
  DimensionsSection,
  FillSection,
  BorderSection,
  TextSection,
  EffectsSection,
} from "./design-sidebar-node-sections";

interface DesignSidebarProps {
  selectedNode: Node | null;
  onUpdateNodeData: (id: string, dataPatch: Record<string, unknown>) => void;
  onUpdateNode: (id: string, patch: Partial<Node>) => void;
}

export function DesignSidebar({
  selectedNode,
  onUpdateNodeData,
  onUpdateNode,
}: DesignSidebarProps) {
  if (!selectedNode) return null;
  const isImage = selectedNode.type === "image";

  return (
    <aside className="absolute right-3 top-3 bottom-3 z-20 w-80 hidden lg:flex flex-col rounded-2xl bg-card shadow-md overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-border/40 shrink-0">
        <p className="text-[11px] font-semibold text-foreground">Design</p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5 capitalize">
          {isImage ? "Image operations" : selectedNode.type}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isImage ? (
          <ImageOperationsSection node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
        ) : (
          <>
            <DimensionsSection node={selectedNode} onUpdateNode={onUpdateNode} />
            <FillSection node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
            <BorderSection node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
            <TextSection node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
            <EffectsSection node={selectedNode} onUpdateNodeData={onUpdateNodeData} />
          </>
        )}
      </div>
    </aside>
  );
}
