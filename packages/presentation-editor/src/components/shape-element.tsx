"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  PptxSlideShape,
  PptxShapeTransform,
  PptxSlideDimensions,
  PptxTextParagraph,
  PptxTableCell,
} from "@dude/presentation-editor/types";
import { ArrowUpToLine, ArrowUp, ArrowDown, ArrowDownToLine, Trash2 } from "lucide-react";
import { cn } from "@dude/ui/utils";
import { ShaderCanvas } from "./shader-canvas";

/**
 * Ensure HTML content fills the full iframe, never overflows, and proxies
 * external assets (3D models etc.) through our asset-proxy to avoid CORS.
 */
function ensureFullCanvasHtml(html: string): string {
  const containmentStyle = `<style data-slide-fix>
html,body{height:100%!important;max-width:100%!important;overflow:hidden!important}
body{min-height:100vh!important}
*{box-sizing:border-box!important}
</style>`;

  // Keep external asset URLs as-is in local mode.
  const proxyScript = `<script data-slide-fix>
(function(){try{
  document.addEventListener('DOMContentLoaded',function(){
    document.querySelectorAll('model-viewer[src]').forEach(function(el){
      var s=el.getAttribute('src');
      if(s&&/^https?:\\/\\//.test(s)){el.setAttribute('src',s);}
    });
  });
}catch(e){}})();
</script>`;

  const injection = containmentStyle + proxyScript;

  if (html.includes("<!DOCTYPE") || html.includes("<html")) {
    if (html.includes("</head>")) {
      return html.replace("</head>", `${injection}</head>`);
    }
    if (html.includes("<head>")) {
      return html.replace("<head>", `<head>${injection}`);
    }
    return html.replace(/<html[^>]*>/i, (match) => `${match}<head>${injection}</head>`);
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
${injection}
<style>*{margin:0}html,body{height:100%}body{min-height:100vh;display:flex;flex-direction:column;font-family:system-ui,sans-serif;background:#0a0a0a;color:#fafafa;overflow:hidden}</style>
</head><body>${html}</body></html>`;
}

type ShapeElementProps = {
  shape: PptxSlideShape;
  slideDimensions: PptxSlideDimensions;
  isSelected: boolean;
  localTransform?: PptxShapeTransform;
  zIndex: number;
  canMoveForward?: boolean;
  canMoveBackward?: boolean;
  onSelect: () => void;
  onDragEnd: (transform: PptxShapeTransform) => void;
  onLocalDrag: (transform: PptxShapeTransform) => void;
  onMoveLayer?: (direction: 'forward' | 'backward' | 'front' | 'back') => void;
  onDeleteShape?: () => void;
  onTableUpdate?: (table: { headers: string[]; rows: string[][] }) => void;
  onTextUpdate?: (paragraphs: string[]) => void;
  onHtmlUpdate?: (htmlContent: string) => void;
};

// Minimum shape size in EMU (~0.15 inches)
const MIN_SIZE_EMU = 137160;

type ResizeDirection = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";

type DragState = {
  startX: number;
  startY: number;
  origTransform: PptxShapeTransform;
  mode: "move" | "rotate" | ResizeDirection;
};

const HANDLE_DEFS: { dir: ResizeDirection; pos: React.CSSProperties; cursor: string }[] = [
  { dir: "nw", pos: { top: -4, left: -4 }, cursor: "nwse-resize" },
  { dir: "n", pos: { top: -4, left: "50%", transform: "translateX(-50%)" }, cursor: "ns-resize" },
  { dir: "ne", pos: { top: -4, right: -4 }, cursor: "nesw-resize" },
  { dir: "w", pos: { top: "50%", left: -4, transform: "translateY(-50%)" }, cursor: "ew-resize" },
  { dir: "e", pos: { top: "50%", right: -4, transform: "translateY(-50%)" }, cursor: "ew-resize" },
  { dir: "sw", pos: { bottom: -4, left: -4 }, cursor: "nesw-resize" },
  { dir: "s", pos: { bottom: -4, left: "50%", transform: "translateX(-50%)" }, cursor: "ns-resize" },
  { dir: "se", pos: { bottom: -4, right: -4 }, cursor: "nwse-resize" },
];

function applyResize(
  orig: PptxShapeTransform,
  dir: ResizeDirection,
  deltaEmuX: number,
  deltaEmuY: number,
  shiftKey?: boolean,
): PptxShapeTransform {
  let { x, y, cx, cy } = orig;

  // When shift is held on a corner handle, constrain to original aspect ratio
  const isCorner = dir === "nw" || dir === "ne" || dir === "sw" || dir === "se";
  if (shiftKey && isCorner && orig.cx > 0 && orig.cy > 0) {
    const aspect = orig.cx / orig.cy;
    // Use the dominant axis to drive the other
    if (Math.abs(deltaEmuX / orig.cx) > Math.abs(deltaEmuY / orig.cy)) {
      deltaEmuY = deltaEmuX / aspect;
      if (dir === "ne" || dir === "sw") deltaEmuY = -deltaEmuY;
    } else {
      deltaEmuX = deltaEmuY * aspect;
      if (dir === "ne" || dir === "sw") deltaEmuX = -deltaEmuX;
    }
  }

  // Horizontal: left edge moves for w/nw/sw, right edge moves for e/ne/se
  if (dir === "w" || dir === "nw" || dir === "sw") {
    const newX = x + deltaEmuX;
    const newCx = cx - deltaEmuX;
    if (newCx >= MIN_SIZE_EMU) {
      x = Math.max(0, newX);
      cx = newCx;
    }
  } else if (dir === "e" || dir === "ne" || dir === "se") {
    cx = Math.max(MIN_SIZE_EMU, cx + deltaEmuX);
  }

  // Vertical: top edge moves for n/nw/ne, bottom edge moves for s/sw/se
  if (dir === "n" || dir === "nw" || dir === "ne") {
    const newY = y + deltaEmuY;
    const newCy = cy - deltaEmuY;
    if (newCy >= MIN_SIZE_EMU) {
      y = Math.max(0, newY);
      cy = newCy;
    }
  } else if (dir === "s" || dir === "sw" || dir === "se") {
    cy = Math.max(MIN_SIZE_EMU, cy + deltaEmuY);
  }

  return { ...orig, x, y, cx, cy };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderTextContent(paragraphs: PptxTextParagraph[], slideWidthPt: number) {
  return paragraphs.map((p, pi) => {
    const alignCss =
      p.align === "ctr"
        ? "text-center"
        : p.align === "r"
          ? "text-right"
          : p.align === "just"
            ? "text-justify"
            : "";

    return (
      <p key={pi} className={cn("m-0 leading-tight", alignCss)}>
        {p.runs.map((r, ri) => {
          const style: React.CSSProperties = {};
          if (r.bold) style.fontWeight = "bold";
          if (r.fontSize) {
            const ptSize = r.fontSize / 100;
            const cqw = (ptSize / slideWidthPt) * 100;
            style.fontSize = `${cqw.toFixed(4)}cqw`;
          }
          if (r.fontFamily) style.fontFamily = `'${r.fontFamily}', sans-serif`;
          if (r.color) style.color = r.color;
          return (
            <span key={ri} style={style} className="whitespace-pre-wrap break-words">
              {r.text}
            </span>
          );
        })}
        {p.runs.length === 0 && <span>&nbsp;</span>}
      </p>
    );
  });
}

function renderTableContent(headers: PptxTableCell[], rows: PptxTableCell[][], isEditable: boolean, editState?: EditableTableState, onCellChange?: (isHeader: boolean, rowIndex: number, colIndex: number, value: string) => void) {
  const cellStyle = (cell: PptxTableCell): React.CSSProperties => {
    const s: React.CSSProperties = { padding: "4px 8px", border: "1px solid #ccc" };
    if (cell.bold) s.fontWeight = "bold";
    if (cell.color) s.color = cell.color;
    if (cell.bgColor) s.background = cell.bgColor;
    if (cell.fontSize) s.fontSize = `${cell.fontSize / 100}pt`;
    return s;
  };

  const inputStyle = (cell: PptxTableCell): React.CSSProperties => {
    const s = cellStyle(cell);
    return {
      ...s,
      width: "100%",
      background: "transparent",
      outline: "none",
      border: "1px solid transparent",
      boxSizing: "border-box" as const,
    };
  };

  return (
    <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", fontSize: "0.8em" }}>
      <thead>
        <tr>
          {headers.map((cell, i) => (
            <th key={i} style={cellStyle(cell)}>
              {isEditable && editState ? (
                <input
                  type="text"
                  value={editState.headers[i] ?? cell.text}
                  style={inputStyle(cell)}
                  onChange={(e) => onCellChange?.(true, 0, i, e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              ) : (
                escapeHtml(cell.text)
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => (
              <td key={ci} style={cellStyle(cell)}>
                {isEditable && editState ? (
                  <input
                    type="text"
                    value={editState.rows[ri]?.[ci] ?? cell.text}
                    style={inputStyle(cell)}
                    onChange={(e) => onCellChange?.(false, ri, ci, e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                ) : (
                  escapeHtml(cell.text)
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type EditableTableState = {
  headers: string[];
  rows: string[][];
};

export function ShapeElement({
  shape,
  slideDimensions,
  isSelected,
  localTransform,
  zIndex,
  canMoveForward,
  canMoveBackward,
  onSelect,
  onDragEnd,
  onLocalDrag,
  onMoveLayer,
  onDeleteShape,
  onTableUpdate,
  onTextUpdate,
  onHtmlUpdate,
}: ShapeElementProps) {
  const dragRef = useRef<DragState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Inline text editing state
  const [isEditingText, setIsEditingText] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // HTML iframe editing state
  const [isEditingHtml, setIsEditingHtml] = useState(false);
  const htmlIframeRef = useRef<HTMLIFrameElement>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, [onSelect]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenu]);

  // Editable table state
  const isEditableTable = isSelected && shape.type === "table" && !!onTableUpdate;
  const [editState, setEditState] = useState<EditableTableState | null>(null);

  // Initialize/reset edit state when selection or shape changes
  useEffect(() => {
    if (isEditableTable && shape.type === "table") {
      setEditState({
        headers: shape.headers.map((h) => h.text),
        rows: shape.rows.map((row) => row.map((c) => c.text)),
      });
    } else {
      setEditState(null);
    }
  }, [isEditableTable, shape]);

  const handleCellChange = useCallback(
    (isHeader: boolean, rowIndex: number, colIndex: number, value: string) => {
      setEditState((prev) => {
        if (!prev) return prev;
        if (isHeader) {
          const newHeaders = [...prev.headers];
          newHeaders[colIndex] = value;
          return { ...prev, headers: newHeaders };
        } else {
          const newRows = prev.rows.map((r) => [...r]);
          if (!newRows[rowIndex]) newRows[rowIndex] = [];
          newRows[rowIndex][colIndex] = value;
          return { ...prev, rows: newRows };
        }
      });
    },
    [],
  );

  const flushTableEdit = useCallback(() => {
    if (editState && onTableUpdate) {
      onTableUpdate({ headers: editState.headers, rows: editState.rows });
    }
  }, [editState, onTableUpdate]);

  const transform = localTransform || shape.transform;

  // Keep a ref to the current effective transform so drag handlers always
  // start from the latest position/size (including pending local overrides).
  const effectiveTransformRef = useRef<PptxShapeTransform>(transform);
  effectiveTransformRef.current = transform;
  const { width: sw, height: sh } = slideDimensions;

  const left = (transform.x / sw) * 100;
  const top = (transform.y / sh) * 100;
  const width = (transform.cx / sw) * 100;
  const height = (transform.cy / sh) * 100;

  const cssTfs: string[] = [];
  if (transform.rot) cssTfs.push(`rotate(${transform.rot}deg)`);
  if (transform.flipH) cssTfs.push("scaleX(-1)");
  if (transform.flipV) cssTfs.push("scaleY(-1)");

  const slideWidthPt = (sw / 914400) * 72;

  const getParentRect = useCallback(() => {
    const parentEl = containerRef.current?.parentElement;
    return parentEl?.getBoundingClientRect() ?? null;
  }, []);

  const computeTransform = useCallback(
    (clientX: number, clientY: number, shiftKey?: boolean): PptxShapeTransform | null => {
      const drag = dragRef.current;
      if (!drag) return null;
      const rect = getParentRect();
      if (!rect) return null;

      if (drag.mode === "rotate") {
        const orig = drag.origTransform;
        // Center of the shape in screen coords
        const centerX = rect.left + ((orig.x + orig.cx / 2) / sw) * rect.width;
        const centerY = rect.top + ((orig.y + orig.cy / 2) / sh) * rect.height;
        const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI) + 90;
        // Snap to 15° increments when Shift is held
        const snapped = shiftKey ? Math.round(angle / 15) * 15 : Math.round(angle);
        return { ...orig, rot: ((snapped % 360) + 360) % 360 || undefined };
      }

      const deltaEmuX = ((clientX - drag.startX) / rect.width) * sw;
      const deltaEmuY = ((clientY - drag.startY) / rect.height) * sh;
      const orig = drag.origTransform;

      if (drag.mode === "move") {
        return {
          ...orig,
          x: Math.max(0, orig.x + deltaEmuX),
          y: Math.max(0, orig.y + deltaEmuY),
        };
      }
      return applyResize(orig, drag.mode as ResizeDirection, deltaEmuX, deltaEmuY, shiftKey);
    },
    [sw, sh, getParentRect],
  );

  // Double-click to enter text/html editing
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (shape.type === "text" && onTextUpdate) {
        setIsEditingText(true);
        setTimeout(() => textAreaRef.current?.focus(), 0);
      } else if (shape.type === "html" && onHtmlUpdate) {
        setIsEditingHtml(true);
        // Enable contentEditable inside the iframe once it's interactive
        setTimeout(() => {
          const iframe = htmlIframeRef.current;
          if (!iframe?.contentDocument?.body) return;
          iframe.contentDocument.body.contentEditable = "true";
          iframe.contentDocument.body.focus();
        }, 50);
      }
    },
    [shape.type, onTextUpdate, onHtmlUpdate],
  );

  // Commit HTML edits when leaving edit mode
  const commitHtmlEdit = useCallback(() => {
    if (!isEditingHtml || !onHtmlUpdate) return;
    const iframe = htmlIframeRef.current;
    if (!iframe?.contentDocument) { setIsEditingHtml(false); return; }
    // Extract the full HTML back from the iframe
    const doc = iframe.contentDocument;
    doc.body.contentEditable = "false";
    const html = `<!DOCTYPE html><html><head>${doc.head.innerHTML}</head><body>${doc.body.innerHTML}</body></html>`;
    onHtmlUpdate(html);
    setIsEditingHtml(false);
  }, [isEditingHtml, onHtmlUpdate]);

  const handleTextBlur = useCallback(() => {
    if (!isEditingText || !onTextUpdate) return;
    const text = textAreaRef.current?.value ?? "";
    const paragraphs = text.split("\n");
    onTextUpdate(paragraphs);
    setIsEditingText(false);
  }, [isEditingText, onTextUpdate]);

  const handleTextKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        setIsEditingText(false);
      }
    },
    [],
  );

  // Start a move drag (from the shape body)
  const handleBodyPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isEditingText || isEditingHtml) return; // Don't drag while editing
      e.stopPropagation();
      onSelect();
      if (!containerRef.current?.parentElement) return;

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origTransform: { ...effectiveTransformRef.current },
        mode: "move",
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [onSelect, isEditingHtml, isEditingText],
  );

  // Start a resize drag (from a handle)
  const handleHandlePointerDown = useCallback(
    (dir: ResizeDirection, e: React.PointerEvent) => {
      e.stopPropagation();
      if (!containerRef.current?.parentElement) return;

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origTransform: { ...effectiveTransformRef.current },
        mode: dir,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const newTransform = computeTransform(e.clientX, e.clientY, e.shiftKey);
      if (newTransform) onLocalDrag(newTransform);
    },
    [computeTransform, onLocalDrag],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const deltaPixelsX = e.clientX - dragRef.current.startX;
      const deltaPixelsY = e.clientY - dragRef.current.startY;

      if (Math.abs(deltaPixelsX) > 2 || Math.abs(deltaPixelsY) > 2) {
        const newTransform = computeTransform(e.clientX, e.clientY, e.shiftKey);
        if (newTransform) onDragEnd(newTransform);
      }

      dragRef.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    },
    [computeTransform, onDragEnd],
  );

  const posStyle: React.CSSProperties = {
    position: "absolute",
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
    zIndex,
    transform: cssTfs.length ? cssTfs.join(" ") : undefined,
    cursor: isSelected ? "move" : "pointer",
    outline: isSelected ? "2px solid #3b82f6" : undefined,
    outlineOffset: isSelected ? "1px" : undefined,
    boxSizing: "border-box",
    userSelect: "none",
  };

  if (shape.fill?.type === "solid") {
    posStyle.backgroundColor = shape.fill.color;
  }

  const menuItems = onMoveLayer ? [
    { label: "Bring to Front", icon: ArrowUpToLine, action: () => onMoveLayer("front"), disabled: !canMoveForward },
    { label: "Bring Forward", icon: ArrowUp, action: () => onMoveLayer("forward"), disabled: !canMoveForward },
    { label: "Send Backward", icon: ArrowDown, action: () => onMoveLayer("backward"), disabled: !canMoveBackward },
    { label: "Send to Back", icon: ArrowDownToLine, action: () => onMoveLayer("back"), disabled: !canMoveBackward },
  ] : [];

  return (
    <div
      ref={containerRef}
      style={posStyle}
      onPointerDown={handleBodyPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      data-shape-index={shape.shapeIndex}
    >
      {/* Resize handles */}
      {isSelected &&
        HANDLE_DEFS.map((h) => (
          <div
            key={h.dir}
            className="absolute w-2 h-2 bg-white border-2 border-blue-500 rounded-full z-50"
            style={{ ...h.pos, cursor: h.cursor } as React.CSSProperties}
            onPointerDown={(e) => handleHandlePointerDown(h.dir, e)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        ))}

      {/* Rotate handle — above top center */}
      {isSelected && (
        <>
          <div className="absolute left-1/2 -translate-x-px w-px h-5 bg-blue-400 z-50" style={{ bottom: "100%" }} />
          <div
            className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-blue-500 rounded-full z-50 cursor-grab active:cursor-grabbing"
            style={{ bottom: "calc(100% + 16px)" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (!containerRef.current?.parentElement) return;
              dragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                origTransform: { ...effectiveTransformRef.current },
                mode: "rotate",
              };
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </>
      )}

      {/* Context menu — rendered via portal to avoid overflow clipping */}
      {contextMenu && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {menuItems.map(({ label, icon: Icon, action, disabled }) => (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => {
                setContextMenu(null);
                action();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
          {onDeleteShape && (
            <>
              <div className="h-px bg-gray-200 my-1" />
              <button
                type="button"
                onClick={() => {
                  setContextMenu(null);
                  onDeleteShape();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </>
          )}
        </div>,
        document.body,
      )}

      {/* Shape content — overflow hidden so content doesn't escape the shape bounds */}
      <div className="absolute inset-0 overflow-hidden">
      {shape.type === "text" && !isEditingText && (
        <div className="flex flex-col justify-center p-1 w-full h-full" style={{ fontSize: `${((18 / slideWidthPt) * 100).toFixed(4)}cqw` }}>
          {renderTextContent(shape.paragraphs, slideWidthPt)}
        </div>
      )}
      {shape.type === "text" && isEditingText && (
        <textarea
          ref={textAreaRef}
          defaultValue={shape.paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join("\n")}
          onBlur={handleTextBlur}
          onKeyDown={handleTextKeyDown}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full h-full p-1 resize-none bg-white/90 outline-none text-inherit"
          style={{
            fontSize: shape.paragraphs[0]?.runs[0]?.fontSize
              ? `${((shape.paragraphs[0].runs[0].fontSize / 100) / slideWidthPt) * 100}cqw`
              : undefined,
            fontFamily: shape.paragraphs[0]?.runs[0]?.fontFamily
              ? `'${shape.paragraphs[0].runs[0].fontFamily}', sans-serif`
              : undefined,
            color: shape.paragraphs[0]?.runs[0]?.color || undefined,
          }}
        />
      )}
      {shape.type === "image" && (
        <>
          {/* Dynamic slide asset; Next Image is not a good fit here. */}
          <img
            src={shape.data}
            alt=""
            className="block w-full h-full object-fill"
            draggable={false}
          />
        </>
      )}
      {shape.type === "table" && (
        <div className="w-full h-full overflow-auto" onBlur={isEditableTable ? flushTableEdit : undefined}>
          {renderTableContent(shape.headers, shape.rows, isEditableTable, editState ?? undefined, handleCellChange)}
        </div>
      )}
      {shape.type === "line" && (
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            {(shape.endMarker === "arrow" || shape.endMarker === "triangle") && (
              <marker id={`end-${shape.shapeIndex}`} markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={shape.color || "#333333"} />
              </marker>
            )}
            {(shape.startMarker === "arrow" || shape.startMarker === "triangle") && (
              <marker id={`start-${shape.shapeIndex}`} markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                <polygon points="10 0, 0 3.5, 10 7" fill={shape.color || "#333333"} />
              </marker>
            )}
          </defs>
          <line
            x1="0" y1="50" x2="100" y2="50"
            stroke={shape.color || "#333333"}
            strokeWidth={shape.strokeWidth || 2}
            vectorEffect="non-scaling-stroke"
            markerEnd={shape.endMarker && shape.endMarker !== "none" ? `url(#end-${shape.shapeIndex})` : undefined}
            markerStart={shape.startMarker && shape.startMarker !== "none" ? `url(#start-${shape.shapeIndex})` : undefined}
          />
        </svg>
      )}
      {shape.type === "shader" && (
        <ShaderCanvas
          fragment={shape.fragment}
          seed={shape.seed}
          customUniforms={shape.customUniforms}
          textureUrl={shape.textureDataUrl}
          animate
          width={480}
          height={270}
          className="w-full h-full pointer-events-none"
        />
      )}
      {shape.type === "html" && (
        <>
          <iframe
            ref={htmlIframeRef}
            srcDoc={ensureFullCanvasHtml(shape.htmlContent)}
            sandbox="allow-scripts allow-same-origin"
            className="w-full h-full border-0"
            style={{ pointerEvents: isEditingHtml ? "auto" : "none" }}
            title={shape.label || "HTML content"}
            onBlur={commitHtmlEdit}
          />
          {isEditingHtml && (
            <div
              className="absolute top-1 right-1 z-50 flex gap-1"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={commitHtmlEdit}
                className="px-2 py-0.5 text-[10px] font-medium bg-blue-500 text-white rounded shadow hover:bg-blue-600 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
