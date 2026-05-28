"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Plus, Trash2 } from "lucide-react";
import { cn } from "@dude/ui/utils";
import { ScrollArea } from "@dude/ui/components/scroll-area";
import { useDocumentEditorStore } from "@dude/presentation-editor/store";
import type { PptxContent, PptxHtmlShape, Slide } from "@dude/presentation-editor/types";
import { insertPptxSlide } from "@dude/presentation-editor/lib/document-editor-actions";

/**
 * Ensure HTML content fills the full iframe, never overflows, and proxies external assets.
 */
function ensureFullCanvasHtml(html: string): string {
  const fix = `<style data-slide-fix>html,body{height:100%!important;max-width:100%!important;overflow:hidden!important}body{min-height:100vh!important}*{box-sizing:border-box!important}</style><script data-slide-fix>(function(){try{document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('model-viewer[src]').forEach(function(el){var s=el.getAttribute('src');if(s&&/^https?:\\/\\//.test(s)){el.setAttribute('src',s);}});});}catch(e){}})();</script>`;
  if (html.includes("<!DOCTYPE") || html.includes("<html")) {
    if (html.includes("</head>")) return html.replace("</head>", `${fix}</head>`);
    if (html.includes("<head>")) return html.replace("<head>", `<head>${fix}`);
    return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${fix}</head>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>${fix}<style>*{margin:0}html,body{height:100%}body{min-height:100vh;display:flex;flex-direction:column;font-family:system-ui,sans-serif;background:#0a0a0a;color:#fafafa;overflow:hidden}</style></head><body>${html}</body></html>`;
}
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";

/**
 * Render a slide thumbnail by drawing at a fixed reference width (e.g. 960px)
 * and CSS-scaling it to fit the thumbnail container. This avoids browser
 * minimum-font-size issues and produces an exact miniature of the edit view.
 */
const THUMB_RENDER_WIDTH = 960;

function SlideThumb({ slide, dims }: { slide: Slide; dims: { width: number; height: number } }) {
  const shapes = (slide.shapes || []).filter((shape) => shape.type === "html" || shape.type === "shader");
  const renderHeight = (dims.height / dims.width) * THUMB_RENDER_WIDTH;

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: THUMB_RENDER_WIDTH,
          height: renderHeight,
          transform: `scale(var(--thumb-scale, 0.1))`,
          background: slide.background || "#fff",
        }}
      >
        {shapes.map((shape) => {
          const left = (shape.transform.x / dims.width) * 100;
          const top = (shape.transform.y / dims.height) * 100;
          const width = (shape.transform.cx / dims.width) * 100;
          const height = (shape.transform.cy / dims.height) * 100;

          return (
            <div
              key={shape.shapeIndex}
              className="absolute overflow-hidden"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
                zIndex: shape.shapeIndex,
              }}
            >
              {shape.type === "shader" && (
                <div className="w-full h-full bg-gradient-to-br from-purple-600 via-blue-500 to-cyan-400" />
              )}
              {shape.type === "html" && shape.htmlContent && (
                <iframe
                  srcDoc={ensureFullCanvasHtml((shape as PptxHtmlShape).htmlContent)}
                  sandbox="allow-scripts"
                  className="w-full h-full border-0"
                  style={{ pointerEvents: "none" }}
                  tabIndex={-1}
                  loading="lazy"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SortableSlide({
  slide,
  dims,
  isEditing,
  isSelected,
  onClick,
  onDelete,
  onDuplicate,
  totalSlides,
}: {
  slide: Slide;
  dims: { width: number; height: number };
  isEditing: boolean;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  totalSlides: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.uid || `slide-idx-${slide.index}` });

  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);

  // Compute scale factor: thumbnail container width / rendered width
  const [thumbScale, setThumbScale] = useState(0.1);
  useEffect(() => {
    const el = thumbRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setThumbScale(w / THUMB_RENDER_WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const rect = thumbRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({ x: rect.right + 4, y: rect.top });
    }
    setShowMenu(true);
  }, []);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("w-full flex items-start gap-1.5 relative", isDragging && "z-50 opacity-75")}
    >
      {/* Slide number */}
      <span className="text-[10px] text-gray-400 font-medium mt-1 w-4 text-right shrink-0 select-none">
        {slide.index + 1}
      </span>

      {/* Slide thumbnail */}
      <button
        ref={thumbRef}
        type="button"
        onClick={onClick}
        onContextMenu={handleContextMenu}
        className={cn(
          "relative flex-1 rounded border-2 overflow-hidden transition-all cursor-grab active:cursor-grabbing",
          "hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E7C59A]/30",
          isEditing
            ? "border-blue-500 shadow-md"
            : isSelected
              ? "border-[#E7C59A] shadow-sm"
              : "border-gray-200",
        )}
        style={{
          aspectRatio: `${dims.width} / ${dims.height}`,
          "--thumb-scale": thumbScale,
        } as React.CSSProperties}
        {...attributes}
        {...listeners}
      >
        <SlideThumb slide={slide} dims={dims} />
      </button>

      {/* Context menu (portal to avoid sidebar overflow clipping) */}
      {showMenu && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[200] bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[120px]"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <button
            type="button"
            onClick={() => {
              setShowMenu(false);
              onDuplicate();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Copy className="h-3 w-3" />
            Duplicate slide
          </button>
          <button
            type="button"
            disabled={totalSlides <= 1}
            onClick={() => {
              setShowMenu(false);
              onDelete();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            Delete slide
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}

export function SlideSidebar() {
  const document = useDocumentEditorStore((s) => s.document);
  const editingSlideIndex = useDocumentEditorStore((s) => s.editingSlideIndex);
  const selectedSlideIndices = useDocumentEditorStore((s) => s.selectedSlideIndices);
  const reorderSlides = useDocumentEditorStore((s) => s.reorderSlides);
  const deleteSlides = useDocumentEditorStore((s) => s.deleteSlides);
  const enterSlideEditMode = useDocumentEditorStore((s) => s.enterSlideEditMode);
  const [addingSlide, setAddingSlide] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (!document) return null;

  const content = document.content as PptxContent;
  const slides = content.slides || [];
  const dims = content.slideDimensions || { width: 12192000, height: 6858000 };

  async function handleAddSlide() {
    if (addingSlide) return;
    setAddingSlide(true);
    try {
      const lastIndex = slides.length > 0 ? slides[slides.length - 1].index : null;
      await insertPptxSlide(lastIndex, "");
    } catch (err) {
      console.error("Add slide failed:", err);
    } finally {
      setAddingSlide(false);
    }
  }

  const slideIds = slides.map((s) => s.uid || `slide-idx-${s.index}`);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = slides.findIndex((s) => (s.uid || `slide-idx-${s.index}`) === active.id);
    const toIdx = slides.findIndex((s) => (s.uid || `slide-idx-${s.index}`) === over.id);
    if (fromIdx !== -1 && toIdx !== -1) {
      reorderSlides(fromIdx, toIdx);
    }
  }

  return (
    <div className="w-[120px] shrink-0 flex flex-col h-full min-h-0">
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col items-center gap-2 p-2 pt-4">
          {slides.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext
                items={slideIds}
                strategy={verticalListSortingStrategy}
              >
                {slides.map((slide) => {
                  const isEditing = editingSlideIndex === slide.index;
                  const isSelected = selectedSlideIndices.includes(slide.index);

                  return (
                    <SortableSlide
                      key={slide.uid || `slide-idx-${slide.index}`}
                      slide={slide}
                      dims={dims}
                      isEditing={isEditing}
                      isSelected={isSelected}
                      onClick={() => enterSlideEditMode(slide.index)}
                      onDelete={() => deleteSlides([slide.index])}
                      onDuplicate={() => {
                        const c = useDocumentEditorStore.getState().document?.content as PptxContent | undefined;
                        if (!c) return;
                        const src = c.slides[slide.index];
                        if (!src) return;
                        const dup = JSON.parse(JSON.stringify(src));
                        dup.uid = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                        const slides2 = [...c.slides];
                        slides2.splice(slide.index + 1, 0, dup);
                        slides2.forEach((s, i) => { s.index = i; });
                        useDocumentEditorStore.getState().setContent({ ...c, slides: slides2 });
                        enterSlideEditMode(slide.index + 1);
                      }}
                      totalSlides={slides.length}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          )}
          {/* Add slide button — after last slide, matching slide row layout */}
          <div className="w-full flex items-start gap-1.5">
            <span className="text-[10px] text-transparent font-medium mt-1 w-4 shrink-0 select-none">&nbsp;</span>
            <button
              type="button"
              onClick={handleAddSlide}
              disabled={addingSlide}
              className="flex-1 flex items-center justify-center gap-1 rounded border-2 border-dashed border-border/50 text-muted-foreground/50 hover:border-border hover:text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
              style={{ aspectRatio: `${dims.width} / ${dims.height}` }}
              title="Add slide"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">Add slide</span>
            </button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
