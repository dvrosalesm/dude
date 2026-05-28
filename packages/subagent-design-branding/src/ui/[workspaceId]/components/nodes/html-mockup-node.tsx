"use client";

import { memo, useMemo, useRef, useState } from "react";
import {
  Handle,
  NodeResizer,
  Position,
  type NodeProps,
} from "@xyflow/react";
import { Code2, ExternalLink, Eye, Copy, Check } from "lucide-react";
import { CanvasNodeRefHandle } from "./canvas-ref-handle";
import { DeleteNodeButton } from "./delete-node-button";
import { DownloadNodeButton } from "./download-node-button";
import { downloadAsFile, slugifyForFilename } from "./download-helpers";

interface HtmlMockupData {
  label?: string;
  html?: string;
  /** Inner viewport width the iframe simulates (e.g. 1280, 390). */
  deviceWidth?: number;
  /** Inner viewport height the iframe simulates. */
  deviceHeight?: number;
}

function HtmlMockupNodeInner({ id, data, selected }: NodeProps) {
  const {
    label = "HTML mockup",
    html = "",
    deviceWidth = 1280,
    deviceHeight = 720,
  } = (data || {}) as HtmlMockupData;

  const refContent = [
    `[Canvas reference — HTML mockup]`,
    `Label: ${label}`,
    `Viewport: ${deviceWidth}×${deviceHeight}`,
    `Use this mockup as visual context. To inspect or modify the HTML, call workspace_read({ collection: "canvasSnapshot" }) and read the node's data.html (id: ${id}).`,
  ].join("\n");

  const [view, setView] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Wrap raw HTML fragments in a minimal document so they render predictably.
  // Always inject a !important scroll-fix style — generated mockups often set
  // body { overflow: hidden } or a fixed viewport height that prevents the
  // page from scrolling when the user opens it in a real tab.
  const documentSrc = useMemo(() => {
    const trimmed = html.trim();
    if (!trimmed) return "";
    const scrollFix =
      "<style>html,body{overflow:auto !important;height:auto !important;min-height:100%}</style>";
    if (/^<!doctype html|^<html/i.test(trimmed)) {
      if (/<\/head>/i.test(trimmed)) {
        return trimmed.replace(/<\/head>/i, `${scrollFix}</head>`);
      }
      return trimmed.replace(/<body([^>]*)>/i, `<body$1>${scrollFix}`);
    }
    return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><style>html,body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif}</style>${scrollFix}</head><body>${trimmed}</body></html>`;
  }, [html]);

  function copyHtml() {
    if (!html) return;
    navigator.clipboard.writeText(html).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  function openInTab() {
    if (!documentSrc) return;
    const blob = new Blob([documentSrc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return (
    <div ref={wrapperRef} className="relative h-full w-full group/html-node">
      <NodeResizer
        isVisible={selected}
        minWidth={320}
        minHeight={240}
        lineClassName="!border-foreground/20"
        handleClassName="!bg-foreground/40 !border-background"
      />
      <Handle type="target" position={Position.Top} className="!opacity-0" />

      <div className="absolute inset-0 rounded-lg overflow-hidden bg-white shadow-md ring-1 ring-border">
        {view === "preview" ? (
          documentSrc ? (
            <ScaledIframe
              srcDoc={documentSrc}
              deviceWidth={deviceWidth}
              deviceHeight={deviceHeight}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              No HTML provided
            </div>
          )
        ) : (
          <pre className="h-full w-full overflow-auto bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-200">
            <code>{html || "// no HTML provided"}</code>
          </pre>
        )}
      </div>

      <div
        className={`absolute left-full top-0 ml-2 z-10 flex flex-col items-start gap-1.5 transition-opacity ${
          selected
            ? "opacity-100"
            : "opacity-0 group-hover/html-node:opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={() => setView(view === "preview" ? "code" : "preview")}
          className="nodrag inline-flex items-center gap-1.5 rounded-full bg-background/95 backdrop-blur px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm border border-border/40 transition-colors hover:bg-background whitespace-nowrap"
          title={view === "preview" ? "View code" : "View preview"}
        >
          {view === "preview" ? (
            <>
              <Code2 className="h-3 w-3" />
              Code
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" />
              Preview
            </>
          )}
        </button>
        <button
          type="button"
          onClick={copyHtml}
          className="nodrag inline-flex items-center gap-1.5 rounded-full bg-background/95 backdrop-blur px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm border border-border/40 transition-colors hover:bg-background whitespace-nowrap"
          title="Copy HTML"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
        <button
          type="button"
          onClick={openInTab}
          className="nodrag inline-flex items-center gap-1.5 rounded-full bg-background/95 backdrop-blur px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm border border-border/40 transition-colors hover:bg-background whitespace-nowrap"
          title="Open in new tab"
        >
          <ExternalLink className="h-3 w-3" />
          Open
        </button>
        {html && (
          <DownloadNodeButton
            title="Download as HTML file"
            onClick={() =>
              downloadAsFile(
                html,
                `${slugifyForFilename(label, "mockup")}.html`,
                "text/html;charset=utf-8",
              )
            }
          />
        )}
        <CanvasNodeRefHandle
          id={id}
          type="htmlMockup"
          name={label}
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

interface ScaledIframeProps {
  srcDoc: string;
  deviceWidth: number;
  deviceHeight: number;
}

function ScaledIframe({ srcDoc, deviceWidth, deviceHeight }: ScaledIframeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useMemo(() => {
    if (typeof window === "undefined") return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const next = Math.min(width / deviceWidth, height / deviceHeight, 1);
        setScale(next);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();

  }, [deviceWidth, deviceHeight]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-zinc-100"
    >
      <iframe
        title="HTML mockup preview"
        sandbox="allow-same-origin"
        srcDoc={srcDoc}
        style={{
          width: deviceWidth,
          height: deviceHeight,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          background: "white",
        }}
      />
    </div>
  );
}

export const HtmlMockupNode = memo(HtmlMockupNodeInner);
