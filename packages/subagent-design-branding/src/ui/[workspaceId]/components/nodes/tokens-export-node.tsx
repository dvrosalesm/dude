"use client";

import { memo, useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { Check, Copy } from "lucide-react";
import { CanvasNodeRefHandle } from "./canvas-ref-handle";
import { DeleteNodeButton } from "./delete-node-button";
import { DownloadNodeButton } from "./download-node-button";
import { downloadAsFile } from "./download-helpers";

interface TokensData {
  css?: string;
  tailwind?: string;
  json?: string;
}

const TABS = [
  { id: "css" as const, label: "CSS" },
  { id: "tailwind" as const, label: "Tailwind" },
  { id: "json" as const, label: "JSON" },
];

function TokensExportNodeInner({ id, data, selected }: NodeProps) {
  const { css = "", tailwind = "", json = "" } = (data || {}) as TokensData;
  const [active, setActive] = useState<"css" | "tailwind" | "json">("css");
  const [copied, setCopied] = useState(false);

  const value = active === "css" ? css : active === "tailwind" ? tailwind : json;
  const refContent = [
    "[Canvas reference — design tokens export]",
    css ? `\n[CSS]\n${css}` : "",
    tailwind ? `\n[Tailwind]\n${tailwind}` : "",
    json ? `\n[JSON]\n${json}` : "",
  ]
    .filter(Boolean)
    .join("");

  function copyAll() {
    if (!value) return;
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="relative h-full w-full group/tokens-node">
      <NodeResizer
        isVisible={selected}
        minWidth={300}
        minHeight={240}
        lineClassName="!border-foreground/20"
        handleClassName="!bg-foreground/40 !border-background"
      />
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="absolute inset-0 rounded-xl bg-card shadow-sm border border-border/40 overflow-hidden flex flex-col">
      <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Design tokens
        </p>
        <button
          type="button"
          onClick={copyAll}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>
      <div className="px-3 pt-2 flex items-center gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`text-[11px] px-2 py-1 rounded transition-colors ${
              active === tab.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <pre className="flex-1 m-3 mt-2 p-2 bg-muted/40 rounded text-[11px] font-mono leading-snug overflow-auto whitespace-pre-wrap break-all">
        {value || (
          <span className="text-muted-foreground">
            No {active.toUpperCase()} export yet — ask the assistant to generate tokens.
          </span>
        )}
      </pre>
      </div>
      <div
        className={`absolute left-full top-0 ml-2 z-10 flex flex-col items-start gap-1.5 transition-opacity ${
          selected
            ? "opacity-100"
            : "opacity-0 group-hover/tokens-node:opacity-100"
        }`}
      >
        {value && (
          <DownloadNodeButton
            title={`Download ${active.toUpperCase()}`}
            onClick={() => {
              const ext = active === "tailwind" ? "js" : active;
              const mime =
                active === "json"
                  ? "application/json"
                  : active === "css"
                    ? "text/css"
                    : "application/javascript";
              downloadAsFile(value, `design-tokens.${ext}`, `${mime};charset=utf-8`);
            }}
          />
        )}
        {(css || tailwind || json) && (
          <CanvasNodeRefHandle
            id={id}
            type="tokensExport"
            name="Design tokens"
            content={refContent}
            positionClass=""
            variant="pill"
          />
        )}
        <DeleteNodeButton id={id} />
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

export const TokensExportNode = memo(TokensExportNodeInner);
