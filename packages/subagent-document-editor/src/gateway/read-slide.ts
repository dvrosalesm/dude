import { Type } from "@sinclair/typebox";
import { internalGet } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { applyPendingEdits } from "@dude/presentation-editor/document-editor/apply-edits";
import { ensureRenderableSlides } from "@dude/presentation-editor/lib/ensure-renderable-slides";
import { isApiError, toolError, toolText, wsPath } from "@dude/sdk/gateway-runtime";

function serializeSlide(slide: any, idx: number, compact = false) {
  const shapes = (slide.shapes || []).map((s: any) => {
    if (s.type === "html") {
      if (compact) {
        // In compact mode, extract just the visible text from HTML instead of the full source
        const html: string = s.htmlContent || s.html || "";
        const text = html
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&[a-z]+;/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        return { type: "html", shapeIndex: s.shapeIndex, textPreview: text.slice(0, 300) };
      }
      return { type: "html", shapeIndex: s.shapeIndex, htmlContent: s.htmlContent || s.html || "" };
    }
    if (s.type === "text") {
      const text = (s.paragraphs || []).map((p: any) =>
        (p.runs || []).map((r: any) => r.text).join("")
      ).join("\n");
      return { type: "text", shapeIndex: s.shapeIndex, text };
    }
    if (s.type === "image") {
      return { type: "image", shapeIndex: s.shapeIndex, hasImage: true };
    }
    return { type: s.type, shapeIndex: s.shapeIndex };
  });

  return {
    slideIndex: idx,
    background: slide.background,
    content: slide.content,
    shapes,
  };
}

export function createReadSlideTool(): ToolDefinition {
  return {
    name: "read_slide",
    label: "Read Slide",
    description:
      "Read the full content of one or more slides, including HTML source code. " +
      "Call this BEFORE editing any slide so you can see the current content and make targeted changes. " +
      "Pass a single 0-based slideIndex, or slideIndices as an array to read multiple slides at once (e.g. [0, 1, 2]). " +
      "Use slideIndices: \"all\" to read every slide in the deck.",
    parameters: Type.Object({
      slideIndex: Type.Optional(Type.Number({
        description: "0-based slide index to read (single slide)",
      })),
      slideIndices: Type.Optional(Type.Union([
        Type.Array(Type.Number(), { description: "Array of 0-based slide indices to read" }),
        Type.Literal("all", { description: "Read all slides in the deck" }),
      ])),
    }),
    execute: async (_toolCallId, params) => {
      // Fetch both documentContent and pending edits in parallel
      const [contentResult, editsResult] = await Promise.all([
        internalGet(wsPath("collection", "documentContent")),
        internalGet(wsPath("collection", "documentEdits")),
      ]);

      if (isApiError(contentResult) && isApiError(editsResult)) {
        return toolError(contentResult.error);
      }

      const rawContent = (contentResult as any)?.documentContent;
      const rawEdits = (editsResult as any)?.documentEdits;

      const hasMaterializedSlides =
        Array.isArray(rawContent?.slides) && rawContent.slides.length > 0;
      const hasPendingQueue = Array.isArray(rawEdits) && rawEdits.length > 0;

      // documentContent is authoritative after materialize; stale documentEdits queues
      // must not be replayed (causes duplicate slides / accidental deletes).
      const documentContent = ensureRenderableSlides(
        (hasMaterializedSlides && hasPendingQueue
          ? rawContent
          : applyPendingEdits(rawContent, rawEdits)) as Parameters<
          typeof ensureRenderableSlides
        >[0],
      );

      if (!documentContent?.slides || documentContent.slides.length === 0) {
        return toolError("No presentation loaded or no slides exist");
      }

      const slides = documentContent.slides as any[];

      // Determine which indices to read
      let indices: number[];
      if (params.slideIndices === "all") {
        indices = slides.map((_: any, i: number) => i);
      } else if (Array.isArray(params.slideIndices)) {
        indices = params.slideIndices.map(Number);
      } else if (params.slideIndex != null) {
        indices = [Number(params.slideIndex)];
      } else {
        return toolError("Provide slideIndex or slideIndices");
      }

      // Validate
      const outOfRange = indices.filter((i) => i < 0 || i >= slides.length);
      if (outOfRange.length) {
        return toolError(
          `Slide indices out of range: ${outOfRange.join(", ")} (deck has ${slides.length} slides, 0-${slides.length - 1})`,
        );
      }

      // Single slide — full content (backward-compatible flat response)
      if (indices.length === 1) {
        return toolText(serializeSlide(slides[indices[0]], indices[0]));
      }

      // Up to 3 slides — full content for each
      // More than 3 — compact mode (text preview only, no full HTML) to avoid flooding context
      const useCompact = indices.length > 3;
      return toolText({
        totalSlides: slides.length,
        mode: useCompact ? "compact" : "full",
        ...(useCompact ? { hint: "Compact mode: HTML source omitted. Call read_slide with a single slideIndex to get the full HTML of a specific slide." } : {}),
        slides: indices.map((i) => serializeSlide(slides[i], i, useCompact)),
      });
    },
  };
}
