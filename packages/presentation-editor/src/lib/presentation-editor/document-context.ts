import type {
  DocumentContent,
  PptxContent,
  DocumentType,
  Slide,
} from "@dude/presentation-editor/types";

const MAX_CONTEXT_LENGTH = 50000; // Max total context to send to AI

/**
 * Builds a serializable text summary of the current presentation for the LLM context.
 */
/**
 * Extract visible text from a slide, including HTML shape content.
 */
function extractSlideText(slide: Pick<Slide, "content" | "shapes">): string {
  const parts: string[] = [];

  // Extract text from text shapes
  for (const shape of slide.shapes || []) {
    if (shape.type === "text") {
      for (const p of shape.paragraphs || []) {
        const line = (p.runs || []).map((r) => r.text).join("");
        if (line.trim()) parts.push(line);
      }
    } else if (shape.type === "table") {
      parts.push((shape.headers || []).map((h) => h.text).join(" | "));
      for (const row of shape.rows || []) {
        parts.push(row.map((c) => c.text).join(" | "));
      }
    } else if (shape.type === "html") {
      // Extract visible text from HTML content by stripping tags
      const html = shape.htmlContent || "";
      if (html) {
        // Remove <style>...</style> and <script>...</script> blocks
        const cleaned = html
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&[a-z]+;/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (cleaned) parts.push(cleaned);
      }
    }
  }

  // Fall back to slide.content if no shapes produced text
  if (parts.length === 0 && slide.content) {
    parts.push(slide.content);
  }

  return parts.join("\n").trim();
}

/** Structural hints for the model (full HTML/CSS still requires read_slide). */
export function extractSlideMetadata(slide: Pick<Slide, "content" | "shapes" | "background">): {
  shapeTypes: string[];
  hasHtml: boolean;
  hasImage: boolean;
  hasTable: boolean;
  htmlControlCount: number;
  cssVariablesSample: string[];
} {
  const shapeTypes: string[] = [];
  let hasHtml = false;
  let hasImage = false;
  let hasTable = false;
  let htmlControlCount = 0;
  const varSet = new Set<string>();

  for (const shape of slide.shapes || []) {
    shapeTypes.push(shape.type);
    if (shape.type === "html") {
      hasHtml = true;
      const html = (shape as { htmlContent?: string }).htmlContent || "";
      if (/id=["']slide-controls["']/.test(html)) {
        try {
          const m = html.match(/id=["']slide-controls["'][^>]*>([\s\S]*?)<\/script>/i);
          if (m) {
            const arr = JSON.parse(m[1]) as unknown;
            htmlControlCount = Array.isArray(arr) ? arr.length : 0;
          }
        } catch {
          htmlControlCount = 0;
        }
      }
      for (const vm of html.matchAll(/--[a-z0-9_-]+/gi)) {
        if (varSet.size < 12) varSet.add(vm[0]);
      }
    } else if (shape.type === "image") {
      hasImage = true;
    } else if (shape.type === "table") {
      hasTable = true;
    }
  }

  const cssVariablesSample = Array.from(varSet).slice(0, 8);

  return {
    shapeTypes,
    hasHtml,
    hasImage,
    hasTable,
    htmlControlCount,
    cssVariablesSample,
  };
}

export function getDocumentContext(
  name: string,
  type: DocumentType,
  content: DocumentContent,
  changesCount: number,
  referenceName?: string | null,
  referenceText?: string | null,
  selectedSlideIndices?: number[],
): string {
  const c = content as PptxContent;
  const hasSelection = selectedSlideIndices && selectedSlideIndices.length > 0;
  const parts: string[] = [
    `Presentation name: ${name}`,
    `Total slides: ${c.slides.length}`,
    `Number of pending changes: ${changesCount}`,
  ];

  if (c.slideDimensions?.width && c.slideDimensions?.height) {
    const { width: w, height: h } = c.slideDimensions;
    const portrait = h > w;
    const square = w === h;
    const label = portrait
      ? "PORTRAIT — design for a TALL narrow canvas (not a 16:9 slide cropped tall)"
      : square
        ? "SQUARE"
        : "LANDSCAPE (widescreen)";
    parts.push(`Canvas (EMU): ${w} × ${h} — ${label}`);
  }

  if (hasSelection) {
    const oneBasedIndices = selectedSlideIndices.map((i) => i + 1).join(", ");
    parts.push(`Currently viewing slide ${oneBasedIndices} (1-based).`);
  }

  parts.push("--- SLIDE INDEX ---");

  if (c.slides && c.slides.length > 0) {
    for (let i = 0; i < c.slides.length; i++) {
      const isActive = hasSelection && selectedSlideIndices!.includes(i);
      const meta = extractSlideMetadata(c.slides[i]);
      const text = extractSlideText(c.slides[i]);
      // One-line summary: first ~120 chars of text content
      const preview = text
        ? text.replace(/\n+/g, " ").slice(0, 120).trim()
        : "(empty)";
      const shapeHints = [
        meta.hasHtml ? "html" : null,
        meta.hasImage ? "img" : null,
        meta.hasTable ? "table" : null,
      ].filter(Boolean).join(",");

      parts.push(
        `${i}: ${preview}${shapeHints ? ` [${shapeHints}]` : ""}${isActive ? " ← ACTIVE" : ""}`,
      );
    }
    parts.push("--- END INDEX ---");
    parts.push(`(${c.slides.length} slides total. Use read_slide to inspect full content before editing.)`);

    // Include full text only for the currently selected slide(s) so the agent has immediate context
    if (hasSelection) {
      parts.push("");
      for (const idx of selectedSlideIndices!) {
        if (idx < 0 || idx >= c.slides.length) continue;
        parts.push(`--- ACTIVE SLIDE ${idx + 1} (index ${idx}) ---`);
        const meta = extractSlideMetadata(c.slides[idx]);
        parts.push(
          `[Meta] shapes: ${meta.shapeTypes.length ? meta.shapeTypes.join(", ") : "none"} | html:${meta.hasHtml ? "yes" : "no"} | image:${meta.hasImage ? "yes" : "no"} | table:${meta.hasTable ? "yes" : "no"} | slide-controls:${meta.htmlControlCount} | css-vars:${meta.cssVariablesSample.length ? meta.cssVariablesSample.join(", ") : "—"}`,
        );
        const text = extractSlideText(c.slides[idx]);
        parts.push(text || "(empty slide)");
        parts.push(`--- END ACTIVE SLIDE ---`);
      }
    }
  } else {
    parts.push(c.textContent || "(No text content available)");
  }

  if (referenceName && referenceText) {
    parts.push("");
    parts.push(`--- REFERENCE DOCUMENT: ${referenceName} ---`);
    parts.push(referenceText);
    parts.push("--- END REFERENCE ---");
  }

  let result = parts.join("\n");

  // Truncate if too long, but try to keep as much as possible
  if (result.length > MAX_CONTEXT_LENGTH) {
    result = result.slice(0, MAX_CONTEXT_LENGTH) + "\n... [Content truncated due to length]";
  }

  return result;
}

export const DOCUMENT_EDITOR_SYSTEM_PROMPT = `You are a presentation editor assistant.

Every slide supports only HTML layers and optional live shader layers. Do not create primitive text boxes, image shapes, tables, charts, icons, lines, arrows, or rectangles.

Use these actions only:
- replaceText for case-insensitive text replacement inside HTML.
- insertPptxSlide to create an empty slide shell.
- deletePptxSlide, reorderPptxSlide, setSlideBackground, resizeSlides, and clearChanges for deck structure.
- addHtmlContent only when a generated HTML slide needs to be applied.

For new or changed slide content, create a slide shell with insertPptxSlide if needed, then generate or apply full-slide HTML. Images, tables, charts, diagrams, icons, and logos must be rendered inside that HTML.

Keep slides concise, visually clear, and presentation-native. Respond in the same language as the user.`;
