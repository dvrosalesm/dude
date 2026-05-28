"use client";

import { MessageSquarePlus } from "lucide-react";

export const CANVAS_ADD_REFERENCE_EVENT = "design-branding:add-reference";

export type CanvasAddReferenceDetail = {
  id: string;
  type: string;
  name: string;
  content: string;
};

interface CanvasNodeRefHandleProps {
  id: string;
  type: string;
  name: string;
  content: string;
  /**
   * Tailwind position classes. Defaults to absolute top-right corner. Pass
   * an empty string to drop absolute positioning so the button can be placed
   * inside a flow-layout container (e.g. a vertical action column outside
   * the host card).
   */
  positionClass?: string;
  /**
   * If `"pill"`, render as a pill-shaped button with a "Reference" label —
   * matches the floating Edit pill on image nodes. Default `"icon"` is the
   * legacy 24×24 square button used by older callers.
   */
  variant?: "icon" | "pill";
  /** Override the pill label. Defaults to "Reference". */
  label?: string;
}

export function CanvasNodeRefHandle({
  id,
  type,
  name,
  content,
  positionClass = "right-1.5 top-1.5",
  variant = "icon",
  label = "Reference",
}: CanvasNodeRefHandleProps) {
  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    const detail: CanvasAddReferenceDetail = { id, type, name, content };
    window.dispatchEvent(
      new CustomEvent(CANVAS_ADD_REFERENCE_EVENT, { detail }),
    );
  }

  const positioning = positionClass ? `absolute z-10 ${positionClass}` : "";

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={`nodrag inline-flex items-center gap-1.5 rounded-full bg-background/95 backdrop-blur px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm border border-border/40 transition-colors hover:bg-background whitespace-nowrap ${positioning}`}
        title={`Reference ${name} in chat`}
        aria-label={`Reference ${name} in chat`}
      >
        <MessageSquarePlus className="h-3 w-3" />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={`nodrag flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-border/40 bg-background/85 backdrop-blur-sm shadow-sm opacity-60 hover:opacity-100 transition-opacity ${positioning}`}
      title="Reference in chat"
      aria-label={`Reference ${name} in chat`}
    >
      <MessageSquarePlus className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}
