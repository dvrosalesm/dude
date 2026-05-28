"use client";

import { Download } from "lucide-react";

/**
 * Floating "Download" pill — same shape as the other action-column pills
 * (Edit, Reference, Delete). Each node passes in its own download handler
 * since the file format differs per node type (image, html, json, …).
 */
export function DownloadNodeButton({
  onClick,
  title = "Download",
  label = "Download",
}: {
  onClick: () => void;
  title?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="nodrag inline-flex items-center gap-1.5 rounded-full bg-background/95 backdrop-blur px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm border border-border/40 transition-colors hover:bg-background whitespace-nowrap"
      title={title}
      aria-label={title}
    >
      <Download className="h-3 w-3" />
      {label}
    </button>
  );
}
