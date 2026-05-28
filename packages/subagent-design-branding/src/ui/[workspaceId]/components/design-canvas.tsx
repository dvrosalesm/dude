"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  getSmoothStepPath,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { presignChatImage } from "@dude/workspaces";
import type {
  DesignCanvasSnapshot,
  DesignNodeType,
} from "@dude/subagent-design-branding/lib/types";
import { CanvasToolbar } from "./canvas-toolbar";
import {
  DesignLayersSidebar,
  type LayerMoveDirection,
} from "./design-layers-sidebar";
import { DesignSidebar } from "./design-sidebar";
import { StickyNoteNode } from "./nodes/sticky-note-node";
import { TextBlockNode } from "./nodes/text-block-node";
import { ShapeNode } from "./nodes/shape-node";
import { FrameNode } from "./nodes/frame-node";
import { ImageNode } from "./nodes/image-node";
import { PaletteNode } from "./nodes/palette-node";
import { TypographyNode } from "./nodes/typography-node";
import { LogoConceptNode } from "./nodes/logo-concept-node";
import { BrandBookNode } from "./nodes/brand-book-node";
import { DesignReviewNode } from "./nodes/design-review-node";
import { TokensExportNode } from "./nodes/tokens-export-node";
import { HtmlMockupNode } from "./nodes/html-mockup-node";

const nodeTypes = {
  stickyNote: StickyNoteNode,
  textBlock: TextBlockNode,
  shape: ShapeNode,
  frame: FrameNode,
  image: ImageNode,
  palette: PaletteNode,
  typography: TypographyNode,
  logoConcept: LogoConceptNode,
  brandBookSection: BrandBookNode,
  designReview: DesignReviewNode,
  tokensExport: TokensExportNode,
  htmlMockup: HtmlMockupNode,
};

const edgeTypes = {
  designPrompt: DesignPromptEdge,
};

interface DesignCanvasProps {
  initialSnapshot: DesignCanvasSnapshot | null;
  onSnapshotChange: (snapshot: DesignCanvasSnapshot) => void;
}

function truncatePrompt(value: string, max = 56) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function DesignPromptEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  selected,
}: EdgeProps) {
  const [expanded, setExpanded] = useState(false);
  const prompt =
    typeof data?.prompt === "string"
      ? data.prompt
      : typeof label === "string"
        ? label
        : "";
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 22,
    offset: 42,
  });
  const displayPrompt = expanded ? prompt : truncatePrompt(prompt);

  return (
    <>
      <BaseEdge
        id={`${id}-halo`}
        path={edgePath}
        style={{
          stroke: "rgba(251, 183, 107, 0.22)",
          strokeWidth: selected ? 10 : 8,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? "#E7C59A" : "#a3a3a3",
          strokeWidth: selected ? 2.5 : 1.5,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          strokeDasharray: selected ? "0" : "6 7",
        }}
      />
      {prompt && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <button
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((value) => !value);
              }}
              className={`pointer-events-auto max-w-[340px] rounded-lg border bg-background/95 text-left text-[11px] leading-4 text-foreground shadow-sm backdrop-blur transition-all hover:border-[#E7C59A]/80 hover:shadow-md ${
                expanded
                  ? "w-[320px] border-[#E7C59A]/80 px-3 py-2 shadow-lg"
                  : "w-[240px] border-border/70 px-2.5 py-1.5"
              }`}
              aria-expanded={expanded}
              title={expanded ? "Collapse prompt" : "Expand prompt"}
            >
              <span className="mb-1 flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Prompt</span>
                <span aria-hidden>{expanded ? "Collapse" : "Expand"}</span>
              </span>
              <span
                className={
                  expanded
                    ? "block max-h-40 overflow-y-auto whitespace-pre-wrap pr-1"
                    : "block truncate"
                }
              >
                {displayPrompt}
              </span>
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}

// Walk up parentId chain to compute a node's absolute (flow-space) position.
// Single-level nesting is the norm here (frames don't nest inside frames),
// but the loop is cheap and handles deeper chains if they ever appear.
function getAbsolutePosition(node: Node, allNodes: Node[]): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;
  while (parentId) {
    const parent = allNodes.find((n) => n.id === parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

// React Flow requires parents to come before their children in the array
// when parentId is set. We only support a single nesting level (frames as
// parents, anything else as child), so a stable two-bucket sort is enough.
function sortFramesFirst(nodes: Node[]): Node[] {
  const frames: Node[] = [];
  const rest: Node[] = [];
  for (const n of nodes) {
    if (n.type === "frame") frames.push(n);
    else rest.push(n);
  }
  return [...frames, ...rest];
}

function DesignCanvasInner({ initialSnapshot, onSnapshotChange }: DesignCanvasProps) {
  const initialNodes = useMemo(
    () => (initialSnapshot?.nodes || []) as Node[],
    [initialSnapshot],
  );
  const initialEdges = useMemo(
    () => (initialSnapshot?.edges || []) as Edge[],
    [initialSnapshot],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSigRef = useRef<string>("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { getViewport, screenToFlowPosition, getIntersectingNodes, getNodes } =
    useReactFlow();

  const scheduleSave = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const viewport = getViewport();
        // Drop transient nodes (mid-upload or failed) from the saved snapshot.
        // If we kept them, a placeholder would become permanent whenever the
        // debounced save fired before the upload resolved — and a deletion
        // mid-upload couldn't stick because the next save would re-include it.
        const persistedNodes = nextNodes.filter((n) => {
          const data = (n.data || {}) as { pending?: boolean; error?: string };
          return !data.pending && !data.error;
        });
        // Drop edges that referenced filtered-out nodes so we don't leave
        // dangling connections in the snapshot.
        const persistedNodeIds = new Set(persistedNodes.map((n) => n.id));
        const persistedEdges = nextEdges.filter(
          (e) => persistedNodeIds.has(e.source) && persistedNodeIds.has(e.target),
        );
        lastSavedSigRef.current = JSON.stringify({
          nodes: persistedNodes,
          edges: persistedEdges,
        });
        onSnapshotChange({
          nodes: persistedNodes as unknown as DesignCanvasSnapshot["nodes"],
          edges: persistedEdges as unknown as DesignCanvasSnapshot["edges"],
          viewport,
        });
      }, 600);
    },
    [getViewport, onSnapshotChange],
  );

  // Two-finger horizontal trackpad scrolls trigger macOS Safari/Chrome's
  // back/forward navigation gesture by default. React Flow's panOnScroll
  // listener can be too late or passive, so we install our own active
  // listener that calls preventDefault on every wheel event over the canvas.
  // The pan still happens because React Flow's listener also runs.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Drop a file or paste an image → upload locally and place it on the canvas
  // as an image node. The node renders the lava-lamp pending state while the
  // upload is in flight, then swaps in the real URL.
  const importImage = useCallback(
    async (file: File, screenX: number, screenY: number) => {
      if (!file.type.startsWith("image/")) return;
      const flowPos = screenToFlowPosition({ x: screenX, y: screenY });
      const nodeId = crypto.randomUUID();
      // Read natural dimensions so the node matches the image's real aspect
      // ratio instead of a fixed 4:3 box. Cap the width so very large
      // screenshots don't dominate the canvas; height scales proportionally.
      const natural = await readImageDimensions(file).catch(() => ({
        width: 320,
        height: 240,
      }));
      const MAX_W = 480;
      const scale = natural.width > MAX_W ? MAX_W / natural.width : 1;
      const width = Math.max(80, Math.round(natural.width * scale));
      const height = Math.max(60, Math.round(natural.height * scale));
      const placeholder: Node = {
        id: nodeId,
        type: "image",
        position: { x: flowPos.x - width / 2, y: flowPos.y - height / 2 },
        width,
        height,
        data: { pending: true, alt: file.name || "Importing image…" },
      };
      setNodes((nds) => {
        const next = [...nds, placeholder];
        scheduleSave(next, edges);
        return next;
      });

      try {
        const url = await presignChatImage(file);
        const data = { url };
        // If the user deleted the placeholder mid-upload the map() finds no
        // match and leaves state alone — we still re-schedule a save so the
        // deletion (which scheduleSave previously skipped because the node
        // was pending and filtered out) gets a clean persist.
        setNodes((nds) => {
          const next = nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    pending: false,
                    url: data.url,
                    alt: file.name || "Image",
                  },
                }
              : n,
          );
          scheduleSave(next, edges);
          return next;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not import image";
        setNodes((nds) => {
          const next = nds.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, pending: false, error: message } }
              : n,
          );
          scheduleSave(next, edges);
          return next;
        });
      }
    },
    [screenToFlowPosition, setNodes, edges, scheduleSave],
  );

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    function onDragOver(e: DragEvent) {
      // Ignore pure xyflow drags / internal drags that don't carry files.
      if (!e.dataTransfer) return;
      const hasFiles = e.dataTransfer.types.includes("Files");
      if (!hasFiles) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }

    function onDrop(e: DragEvent) {
      if (!e.dataTransfer) return;
      const files = Array.from(e.dataTransfer.files || []);
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;
      e.preventDefault();
      // Stagger drops so multiple images don't pile on top of one another.
      const baseX = e.clientX;
      const baseY = e.clientY;
      images.forEach((file, idx) => {
        void importImage(file, baseX + idx * 24, baseY + idx * 24);
      });
    }

    function onPaste(e: ClipboardEvent) {
      if (!e.clipboardData) return;
      // Don't hijack paste while the user is typing in a real input.
      const target = e.target as HTMLElement | null;
      if (target && target.closest("input, textarea, [contenteditable='true']")) {
        return;
      }
      const items = Array.from(e.clipboardData.items || []);
      const imageFiles = items
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);
      if (imageFiles.length === 0) return;
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const baseX = rect.left + rect.width / 2;
      const baseY = rect.top + rect.height / 2;
      imageFiles.forEach((file, idx) => {
        void importImage(file, baseX + idx * 24, baseY + idx * 24);
      });
    }

    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [importImage]);

  // Sync external snapshot updates (e.g. from the agent) into local state.
  // Skip echoes from our own scheduleSave by comparing signatures.
  useEffect(() => {
    if (!initialSnapshot) return;
    const sig = JSON.stringify({
      nodes: initialSnapshot.nodes ?? [],
      edges: initialSnapshot.edges ?? [],
    });
    if (sig === lastSavedSigRef.current) return;
    lastSavedSigRef.current = sig;
    setNodes(sortFramesFirst((initialSnapshot.nodes ?? []) as Node[]));
    setEdges((initialSnapshot.edges ?? []) as Edge[]);
  }, [initialSnapshot, setNodes, setEdges]);

  useEffect(() => {
    setEdges((currentEdges) => {
      let changed = false;
      const next = currentEdges.map((edge) => {
        if (edge.type !== "smoothstep" || !edge.label) return edge;
        changed = true;
        const prompt =
          typeof edge.data?.prompt === "string"
            ? edge.data.prompt
            : typeof edge.label === "string"
              ? edge.label
              : "";
        return {
          ...edge,
          type: "designPrompt",
          data: {
            ...edge.data,
            prompt,
          },
        };
      });
      if (changed) scheduleSave(nodes, next);
      return changed ? next : currentEdges;
    });
  }, [setEdges, nodes, scheduleSave]);

  // Figma-like parenting: when a node is dropped on a frame, parent it to
  // that frame so it moves/scales with the frame. Dragging a child outside
  // of its parent frame removes the parent. Frames themselves never get
  // parented (no nested frames for now).
  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      if (node.type === "frame") return;

      const all = getNodes();
      const intersectingFrames = getIntersectingNodes(node).filter(
        (n) => n.type === "frame",
      );
      const target = intersectingFrames[0];
      const currentParentId = node.parentId;

      if (target && target.id !== currentParentId) {
        const draggedAbs = getAbsolutePosition(node, all);
        const targetAbs = getAbsolutePosition(target, all);
        setNodes((nds) => {
          const next = sortFramesFirst(
            nds.map((n) =>
              n.id === node.id
                ? {
                    ...n,
                    parentId: target.id,
                    position: {
                      x: draggedAbs.x - targetAbs.x,
                      y: draggedAbs.y - targetAbs.y,
                    },
                  }
                : n,
            ),
          );
          scheduleSave(next, edges);
          return next;
        });
      } else if (!target && currentParentId) {
        const draggedAbs = getAbsolutePosition(node, all);
        setNodes((nds) => {
          const next = nds.map((n) =>
            n.id === node.id
              ? { ...n, parentId: undefined, position: draggedAbs }
              : n,
          );
          scheduleSave(next, edges);
          return next;
        });
      }
    },
    [getIntersectingNodes, getNodes, setNodes, edges, scheduleSave],
  );

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      setNodes((nds) => {
        scheduleSave(nds, edges);
        return nds;
      });
    },
    [onNodesChange, setNodes, edges, scheduleSave],
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
      setEdges((eds) => {
        scheduleSave(nodes, eds);
        return eds;
      });
    },
    [onEdgesChange, setEdges, nodes, scheduleSave],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const next = addEdge(
          { ...connection, type: "designPrompt" },
          eds,
        );
        scheduleSave(nodes, next);
        return next;
      });
    },
    [setEdges, nodes, scheduleSave],
  );

  // File-picker entry point from the toolbar. Centers each picked image in
  // the current viewport, staggered slightly so multiple selections don't
  // pile on top of one another. Reuses the same upload flow as paste/drop.
  const handleImportImageFiles = useCallback(
    (files: File[]) => {
      const w = typeof window !== "undefined" ? window.innerWidth : 1200;
      const h = typeof window !== "undefined" ? window.innerHeight : 800;
      const baseX = w / 2;
      const baseY = h / 2;
      files.forEach((file, idx) => {
        void importImage(file, baseX + idx * 24, baseY + idx * 24);
      });
    },
    [importImage],
  );

  // Per-node updates from the right sidebar. We bypass onNodesChange
  // (those updates are framework-driven), so trigger scheduleSave manually.
  const handleUpdateNodeData = useCallback(
    (id: string, dataPatch: Record<string, unknown>) => {
      setNodes((nds) => {
        const next = nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...dataPatch } } : n,
        );
        scheduleSave(next, edges);
        return next;
      });
    },
    [setNodes, edges, scheduleSave],
  );

  const handleUpdateNode = useCallback(
    (id: string, patch: Partial<Node>) => {
      setNodes((nds) => {
        const next = nds.map((n) => (n.id === id ? { ...n, ...patch } : n));
        scheduleSave(next, edges);
        return next;
      });
    },
    [setNodes, edges, scheduleSave],
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.selected) ?? null,
    [nodes],
  );

  const handleSelectNodeFromTree = useCallback(
    (id: string) => {
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          selected: node.id === id,
        })),
      );
    },
    [setNodes],
  );

  const handleReorderNodeFromTree = useCallback(
    (id: string, direction: LayerMoveDirection) => {
      setNodes((nds) => {
        const target = nds.find((node) => node.id === id);
        if (!target?.parentId) return nds;

        const siblings = nds.filter((node) => node.parentId === target.parentId);
        const currentIndex = siblings.findIndex((node) => node.id === id);
        const nextIndex = direction === "up" ? currentIndex + 1 : currentIndex - 1;
        if (
          currentIndex < 0 ||
          nextIndex < 0 ||
          nextIndex >= siblings.length
        ) {
          return nds;
        }

        const reorderedSiblings = [...siblings];
        const [movedNode] = reorderedSiblings.splice(currentIndex, 1);
        if (!movedNode) return nds;
        reorderedSiblings.splice(nextIndex, 0, movedNode);

        const siblingIds = new Set(siblings.map((node) => node.id));
        let replacementIndex = 0;
        const next = nds.map((node) => {
          if (!siblingIds.has(node.id)) return node;
          const replacement = reorderedSiblings[replacementIndex];
          replacementIndex += 1;
          return replacement ?? node;
        });
        scheduleSave(next, edges);
        return next;
      });
    },
    [setNodes, edges, scheduleSave],
  );

  const handleAddNode = useCallback(
    (type: DesignNodeType, data: Record<string, unknown>, size?: { width?: number; height?: number }) => {
      const viewport = getViewport();
      const centerX =
        (-viewport.x + (typeof window !== "undefined" ? window.innerWidth : 1200) / 2) /
        viewport.zoom;
      const centerY =
        (-viewport.y + (typeof window !== "undefined" ? window.innerHeight : 800) / 2) /
        viewport.zoom;

      const id = crypto.randomUUID();
      const newNode: Node = {
        id,
        type,
        position: { x: centerX - 120, y: centerY - 80 },
        data,
        ...(size?.width ? { width: size.width } : {}),
        ...(size?.height ? { height: size.height } : {}),
      };
      setNodes((nds) => {
        const next = [...nds, newNode];
        scheduleSave(next, edges);
        return next;
      });
    },
    [getViewport, setNodes, edges, scheduleSave],
  );

  return (
    <div ref={wrapperRef} className="h-full w-full relative overscroll-contain">
      <style>{`
        .react-flow__node.selected > * {
          box-shadow: 0 0 0 2px #E7C59A, 0 8px 24px rgba(0, 0, 0, 0.08);
          border-radius: inherit;
        }
        .react-flow__node:has([data-image-node-actions]) {
          overflow: visible !important;
        }
        .react-flow__node:hover:has([data-image-node-actions]),
        .react-flow__node.selected:has([data-image-node-actions]),
        .react-flow__node.dragging:has([data-image-node-actions]),
        .react-flow__node:active:has([data-image-node-actions]),
        .react-flow__node:focus-within:has([data-image-node-actions]) {
          z-index: 9000 !important;
        }
      `}</style>
      <CanvasToolbar onAddNode={handleAddNode} onImportImageFiles={handleImportImageFiles} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={initialSnapshot?.viewport}
        fitView={!initialSnapshot?.viewport}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={4}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={false}
        panActivationKeyCode="Space"
        panOnScroll
      >
        <Background gap={24} size={1} color="#dcdcd8" />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap pannable zoomable position="bottom-right" />
      </ReactFlow>
      <DesignLayersSidebar
        nodes={nodes}
        selectedNodeId={selectedNode?.id ?? null}
        onSelectNode={handleSelectNodeFromTree}
        onReorderNode={handleReorderNodeFromTree}
      />
      <DesignSidebar
        selectedNode={selectedNode}
        onUpdateNodeData={handleUpdateNodeData}
        onUpdateNode={handleUpdateNode}
      />
    </div>
  );
}

export function DesignCanvas(props: DesignCanvasProps) {
  return (
    <ReactFlowProvider>
      <DesignCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
