"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  X,
  MousePointerClick,
} from "lucide-react";
import type { LandingPage } from "@dude/specialist-prospect/lib/config";
import { sanitizeLandingHtml } from "@dude/specialist-prospect/lib/sanitize-html";
import { AIGenerationOverlay } from "@dude/ui/components/ai-generation-overlay";

/**
 * Picker script injected into the preview iframe when design mode is on.
 * Highlights elements on hover, posts selected element details to the parent
 * window on click. Designed to work inside a srcDoc iframe with
 * sandbox="allow-scripts" — postMessage to window.parent is allowed.
 */
const DESIGN_PICKER_SCRIPT = `
<script>
(function () {
  if (window.__designPickerInit) return;
  window.__designPickerInit = true;

  var hovered = null;
  var prevOutline = null;

  function setOutline(el, color) {
    if (!el || !el.style) return;
    prevOutline = { outline: el.style.outline, offset: el.style.outlineOffset, cursor: el.style.cursor };
    el.style.outline = '2px dashed ' + color;
    el.style.outlineOffset = '2px';
    el.style.cursor = 'crosshair';
  }
  function clearOutline(el) {
    if (!el || !el.style || !prevOutline) return;
    el.style.outline = prevOutline.outline;
    el.style.outlineOffset = prevOutline.offset;
    el.style.cursor = prevOutline.cursor;
    prevOutline = null;
  }

  function buildSelector(el) {
    if (!el || el === document.body || el === document.documentElement) {
      return el && el.tagName ? el.tagName.toLowerCase() : '';
    }
    if (el.id) return el.tagName.toLowerCase() + '#' + el.id;
    var parts = [];
    var cur = el;
    while (cur && cur !== document.body && parts.length < 6) {
      var part = cur.tagName.toLowerCase();
      if (cur.id) { parts.unshift(part + '#' + cur.id); break; }
      if (cur.className && typeof cur.className === 'string') {
        var cls = cur.className.trim().split(/\\s+/).slice(0, 2).join('.');
        if (cls) part += '.' + cls;
      }
      var parent = cur.parentElement;
      if (parent) {
        var sameTag = [];
        for (var i = 0; i < parent.children.length; i++) {
          if (parent.children[i].tagName === cur.tagName) sameTag.push(parent.children[i]);
        }
        if (sameTag.length > 1) {
          part += ':nth-of-type(' + (sameTag.indexOf(cur) + 1) + ')';
        }
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  function shortLabel(el) {
    var tag = el.tagName.toLowerCase();
    if (el.id) return tag + '#' + el.id;
    if (el.className && typeof el.className === 'string') {
      var cls = el.className.trim().split(/\\s+/)[0];
      if (cls) return tag + '.' + cls;
    }
    var text = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 28);
    return text ? tag + ' "' + text + (text.length === 28 ? '…' : '') + '"' : tag;
  }

  document.addEventListener('mouseover', function (e) {
    var target = e.target;
    if (target === hovered) return;
    if (hovered) clearOutline(hovered);
    if (target === document.body || target === document.documentElement) {
      hovered = null;
      return;
    }
    hovered = target;
    setOutline(hovered, '#E7C59A');
  }, true);

  // Clear outline when the cursor leaves the iframe entirely.
  document.addEventListener('mouseleave', function () {
    if (hovered) { clearOutline(hovered); hovered = null; }
  }, true);

  document.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    if (!el || el === document.body || el === document.documentElement) return;
    var html = el.outerHTML || '';
    if (html.length > 2000) html = html.slice(0, 2000) + '\\n…[truncated]';
    var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    window.parent.postMessage({
      type: 'prospect-design-ref',
      ref: {
        id: 'design-ref-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        label: shortLabel(el),
        selector: buildSelector(el),
        html: html,
        rect: rect ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } : null,
      },
    }, '*');
  }, true);

  // Submit anywhere blocked while picking, to prevent accidental submits
  document.addEventListener('submit', function (e) { e.preventDefault(); e.stopPropagation(); }, true);
})();
</script>`;

interface LandingPagePreviewProps {
  landingPages: LandingPage[];
  selectedPage: LandingPage | null;
  selectedPageId: string | null;
  onSelectPage: (id: string) => void;
  onTogglePublish?: (pageId: string, published: boolean) => void;
  onDeletePage?: (pageId: string) => void;
  publishLoading?: boolean;
  sending?: boolean;
}

function buildPreviewHtml(page: LandingPage, allowedPageIds: string[]): string {
  const formFieldsHtml = page.fields
    .map((field) => {
      let input: string;
      if (field.type === "textarea") {
        input = `<textarea name="${field.name}" placeholder="${field.placeholder || ""}" ${field.required ? "required" : ""} style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;font-family:inherit;min-height:80px;resize:vertical;box-sizing:border-box;"></textarea>`;
      } else if (field.type === "select") {
        const options = (field.options || [])
          .map((opt) => `<option value="${opt}">${opt}</option>`)
          .join("");
        input = `<select name="${field.name}" ${field.required ? "required" : ""} style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;font-family:inherit;background:white;box-sizing:border-box;"><option value="">${field.placeholder || "Select..."}</option>${options}</select>`;
      } else {
        input = `<input type="${field.type}" name="${field.name}" placeholder="${field.placeholder || ""}" ${field.required ? "required" : ""} style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;font-family:inherit;box-sizing:border-box;" />`;
      }
      return `<div style="margin-bottom:16px;"><label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:#374151;">${field.label}${field.required ? " *" : ""}</label>${input}</div>`;
    })
    .join("\n");

  const formHtml = page.fields.length > 0
    ? `<form id="capture-form-element" onsubmit="return false;" style="max-width:400px;margin:0 auto;">
        ${formFieldsHtml}
        <button type="submit" style="width:100%;padding:12px 24px;background:#E7C59A;color:#0f172a;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Submit</button>
      </form>`
    : `<div id="capture-form" style="text-align:center;padding:20px;color:#9ca3af;font-size:14px;">Form fields not configured yet</div>`;

  // Replace the capture-form placeholder with the actual form
  const safeHtml = sanitizeLandingHtml(page.html, { allowedPageIds });
  const bodyHtml =
    safeHtml.includes('id="capture-form"')
      ? safeHtml.replace(/<div\s+id="capture-form"\s*><\/div>/i, formHtml)
      : safeHtml + formHtml;

  const baseHref =
    typeof window !== "undefined" ? `${window.location.origin}/` : "/";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <base href="${baseHref}" />
  <title>${page.title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; }
    ${page.styles || ""}
  </style>
</head>
<body>
  ${bodyHtml}
  <script>
    // Smooth-scroll fragment-only links inside the iframe. Without this the
    // <base href="origin/"> resolves href="#x" to a navigation away from the
    // iframe, which breaks anchor-style nav inside the landing page.
    (function() {
      document.addEventListener('click', function(e) {
        var el = e.target;
        var anchor = el && el.closest ? el.closest('a[href^="#"]') : null;
        if (!anchor) return;
        e.preventDefault();
        var href = anchor.getAttribute('href') || '';
        var id = href.slice(1);
        var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var behavior = prefersReduced ? 'auto' : 'smooth';
        if (!id) {
          window.scrollTo({ top: 0, behavior: behavior });
          return;
        }
        var target = document.getElementById(id);
        if (target) target.scrollIntoView({ behavior: behavior, block: 'start' });
      });
    })();
  </script>
</body>
</html>`;
}

export function LandingPagePreview({
  landingPages,
  selectedPage,
  selectedPageId,
  onSelectPage,
  onTogglePublish,
  onDeletePage,
  publishLoading,
  sending,
}: LandingPagePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [designMode, setDesignMode] = useState(false);

  // Bridge: iframe (postMessage) → window CustomEvent the chat panel listens
  // for. Auto-exit design mode after a pick — single-select is enough, and
  // the user wants to type immediately without clicking the toggle off.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || data.type !== "prospect-design-ref" || !data.ref) return;
      window.dispatchEvent(
        new CustomEvent("prospect:design-ref", { detail: data.ref }),
      );
      setDesignMode(false);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const allowedPageIds = useMemo(
    () =>
      landingPages
        .filter((p) => p.id !== selectedPage?.id)
        .map((p) => p.id),
    [landingPages, selectedPage?.id],
  );

  const previewHtml = useMemo(() => {
    let html: string | null = null;
    if (!selectedPage) html = null;
    else if (selectedPage.html) html = buildPreviewHtml(selectedPage, allowedPageIds);

    if (!html) return null;
    if (designMode) {
      // Inject right before </body> so the picker runs after the page content
      // exists. Falls back to appending if no </body> tag is present.
      const idx = html.lastIndexOf("</body>");
      html = idx !== -1
        ? html.slice(0, idx) + DESIGN_PICKER_SCRIPT + html.slice(idx)
        : html + DESIGN_PICKER_SCRIPT;
    }
    return html;
  }, [selectedPage, allowedPageIds, designMode]);

  if (landingPages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="rounded-2xl bg-orange-50 p-4 mb-4">
          <FileText className="h-8 w-8 text-orange-400" />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {"No landing page yet"}
        </h3>
        <p className="text-xs text-muted-foreground max-w-[280px]">
          {"Ask the AI assistant to design a landing page for you. Describe your product, service, or event and the AI will create a professional page."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page selector + URL bar */}
      <div className="px-4 py-3 border-b border-border bg-background space-y-2">
        {landingPages.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto">
            {landingPages.map((page) => (
              <div
                key={page.id}
                className={`group shrink-0 flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  page.id === selectedPageId
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                onClick={() => onSelectPage(page.id)}
              >
                {page.title}
                {onDeletePage && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(page.id);
                    }}
                    className="ml-0.5 p-0.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-all"
                    title="Delete page"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {selectedPage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={publishLoading}
              onClick={() => onTogglePublish?.(selectedPage.id, !selectedPage.published)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                selectedPage.published
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              <span
                className={`relative inline-flex h-3.5 w-6 shrink-0 rounded-full transition-colors ${
                  selectedPage.published ? "bg-emerald-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform ${
                    selectedPage.published ? "translate-x-2.5" : "translate-x-0"
                  }`}
                />
              </span>
              {selectedPage.published ? "Published" : "Draft"}
            </button>
            <button
              type="button"
              onClick={() => setDesignMode((v) => !v)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                designMode
                  ? "bg-primary/15 text-primary border border-primary/40"
                  : "text-muted-foreground hover:bg-muted border border-transparent"
              }`}
              title={
                designMode
                  ? "Design mode on — click any element in the preview to add it as a chat reference"
                  : "Design mode — pick elements to reference in chat"
              }
            >
              <MousePointerClick className="h-3 w-3" />
              {designMode ? "Picking" : "Design"}
            </button>
            {designMode && (
              <span className="text-[10px] text-muted-foreground">
                Click any element to add it as a chat reference
              </span>
            )}
          </div>
        )}
      </div>

      {/* Preview iframe */}
      <div className="relative flex-1 bg-white overflow-hidden">
        {previewHtml ? (
          <iframe
            ref={iframeRef}
            srcDoc={previewHtml}
            className="w-full h-full border-0"
            sandbox="allow-scripts"
            title="Landing page preview"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Select a landing page to preview
          </div>
        )}
        <AIGenerationOverlay active={Boolean(sending)} />
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl shadow-lg border border-border p-6 max-w-sm w-full mx-4">
            <h3 className="text-sm font-semibold text-foreground mb-1">Delete landing page?</h3>
            <p className="text-xs text-muted-foreground mb-4">
              This will permanently remove &ldquo;{landingPages.find((p) => p.id === deleteConfirmId)?.title}&rdquo; and any collected leads. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeletePage?.(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
