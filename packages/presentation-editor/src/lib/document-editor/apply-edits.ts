/**
 * Pure, server-safe presentation edit logic.
 *
 * Takes a PptxContent JSON structure + array of edit commands,
 * returns the modified PptxContent. No Zustand, no browser APIs.
 *
 * Used by:
 * - Server: assistant route applies edits after agent completes
 * - Client: polling loop applies edits as they arrive
 */

type Slide = {
  index: number;
  uid: string;
  content: string;
  shapes: JsonValue[];
  background?: string;
  transition? : JsonValue;
};

type PptxContent = {
  slides: Slide[];
  slideDimensions?: { width: number; height: number };
  [key: string]: unknown;
};

type EditAction = {
  action: string;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(): string {
  return `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureSlides(c: PptxContent, count: number): PptxContent {
  if (c.slides.length >= count) return c;
  const slides = [...c.slides];
  while (slides.length < count) {
    slides.push({ index: slides.length, uid: uid(), content: "", shapes: [], background: "#ffffff" });
  }
  return { ...c, slides };
}

function deriveSlideContent(slide: Slide): string {
  const parts: string[] = [];
  for (const shape of slide.shapes || []) {
    if (shape.type === "html") {
      parts.push(stripHtmlText(String(shape.htmlContent || "")));
    } else if (shape.type === "text") {
      for (const p of shape.paragraphs || []) {
        parts.push((p.runs || []).map((r: JsonValue) => r.text).join(""));
      }
    } else if (shape.type === "table") {
      parts.push((shape.headers || []).map((h: JsonValue) => h.text).join("\t"));
      for (const row of shape.rows || []) {
        parts.push(row.map((c: JsonValue) => c.text).join("\t"));
      }
    }
  }
  return parts.join("\n");
}

function stripHtmlText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainTextToHtml(text: string): string {
  const body = text
    .split("\n")
    .map((line, index) => {
      const tag = index === 0 ? "h1" : "p";
      return `<${tag}>${escapeHtml(line || " ")}</${tag}>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 3vh;
      padding: 9vh 8vw;
      background: #ffffff;
      color: #111827;
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    }
    h1 { margin: 0; font-size: clamp(44px, 8cqmin, 92px); line-height: 0.95; letter-spacing: 0; }
    p { margin: 0; max-width: 72ch; font-size: clamp(22px, 3cqmin, 38px); line-height: 1.35; }
  </style>
</head>
<body>
${body || "<h1></h1>"}
</body>
</html>`;
}

function replaceAllCaseInsensitive(value: string, search: string, replacement: string): { text: string; count: number } {
  const searchLower = search.toLowerCase();
  const lower = value.toLowerCase();
  if (!searchLower || !lower.includes(searchLower)) return { text: value, count: 0 };

  let text = "";
  let idx = 0;
  let count = 0;
  let pos: number;
  while ((pos = lower.indexOf(searchLower, idx)) !== -1) {
    text += value.slice(idx, pos) + replacement;
    idx = pos + search.length;
    count++;
  }
  text += value.slice(idx);
  return { text, count };
}

function nextShapeIndex(slide: Slide): number {
  let max = -1;
  for (const s of slide.shapes || []) max = Math.max(max, s.shapeIndex ?? 0);
  return max + 1;
}

function normalize(text: string): string {
  return text.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
}

function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text.trim());
}

function slideHtmlContent(text: string): string {
  return looksLikeHtml(text) ? text : plainTextToHtml(text);
}

function reindex(slides: Slide[]) {
  slides.forEach((s, i) => { s.index = i; });
}

// ---------------------------------------------------------------------------
// Edit handlers — pure functions: (content, edit) → content
// ---------------------------------------------------------------------------

function insertSlide(c: PptxContent, edit: EditAction): PptxContent {
  const text = normalize(String(edit.content || ""));
  const slides = [...c.slides];
  const dims = c.slideDimensions || { width: 12192000, height: 6858000 };
  const shapes =
    text.length > 0
      ? [
          {
            type: "html",
            transform: { x: 0, y: 0, cx: dims.width, cy: dims.height },
            htmlContent: slideHtmlContent(text),
            label: "Slide HTML",
            shapeIndex: 0,
          },
        ]
      : [];
  const newSlide: Slide = {
    index: 0,
    uid: uid(),
    content: text,
    shapes,
    background: typeof edit.background === "string" ? `#${edit.background.replace(/^#/, "")}` : "#ffffff",
  };
  let insertAt = edit.afterSlideIndex === null || edit.afterSlideIndex === undefined ? 0 : Number(edit.afterSlideIndex) + 1;
  if (insertAt > slides.length) insertAt = slides.length;
  slides.splice(insertAt, 0, newSlide);
  reindex(slides);
  return { ...c, slides };
}

function deleteSlide(c: PptxContent, edit: EditAction): PptxContent {
  const idx = Number(edit.slideIndex);
  if (c.slides.length <= 1 || idx < 0 || idx >= c.slides.length) return c;
  const slides = c.slides.filter((_, i) => i !== idx);
  reindex(slides);
  return { ...c, slides };
}

function deleteSlides(c: PptxContent, edit: EditAction): PptxContent {
  const indices = (edit as { slideIndices?: unknown }).slideIndices;
  if (!Array.isArray(indices)) return c;
  const toRemove = new Set(
    (indices as number[]).filter((i) => typeof i === "number" && i >= 0 && i < c.slides.length),
  );
  if (toRemove.size === 0) return c;

  // If deleting ALL slides, keep one empty slide (can't have zero slides)
  if (toRemove.size >= c.slides.length) {
    const emptySlide: Slide = {
      index: 0,
      uid: uid(),
      content: "",
      shapes: [],
      background: "#ffffff",
    };
    return { ...c, slides: [emptySlide] };
  }

  const slides = c.slides.filter((_, i) => !toRemove.has(i));
  reindex(slides);
  return { ...c, slides };
}

function reorderSlide(c: PptxContent, edit: EditAction): PptxContent {
  const from = Number(edit.fromIndex);
  const to = Number(edit.toIndex);
  if (from < 0 || from >= c.slides.length || to < 0 || to >= c.slides.length) return c;
  const slides = [...c.slides];
  const [moved] = slides.splice(from, 1);
  slides.splice(to, 0, moved);
  reindex(slides);
  return { ...c, slides };
}

function updateSlide(c: PptxContent, edit: EditAction): PptxContent {
  const idx = Number(edit.slideIndex);
  if (idx < 0) return c;
  c = ensureSlides(c, idx + 1);
  const text = normalize(String(edit.newContent || ""));

  const slide = { ...c.slides[idx] };
  const dims = c.slideDimensions || { width: 12192000, height: 6858000 };
  const shaderLayers = (slide.shapes || []).filter((s: JsonValue) => s.type === "shader");
  slide.shapes = [
    ...shaderLayers,
    {
      type: "html",
      transform: { x: 0, y: 0, cx: dims.width, cy: dims.height },
      htmlContent: slideHtmlContent(text),
      label: "Slide HTML",
      shapeIndex: nextShapeIndex({ ...slide, shapes: shaderLayers }),
    },
  ];
  slide.content = deriveSlideContent(slide);

  const slides = [...c.slides];
  slides[idx] = slide;
  return { ...c, slides };
}

function setSlideBackground(c: PptxContent, edit: EditAction): PptxContent {
  const idx = Number(edit.slideIndex);
  if (idx < 0) return c;
  c = ensureSlides(c, idx + 1);
  const color = `#${String(edit.color || "ffffff").replace(/^#/, "")}`;
  const slides = c.slides.map((s, i) => i === idx ? { ...s, background: color } : s);
  return { ...c, slides };
}

function resizeSlides(c: PptxContent, edit: EditAction): PptxContent {
  return { ...c, slideDimensions: { width: Number(edit.width), height: Number(edit.height) } };
}

function replaceText(c: PptxContent, edit: EditAction): PptxContent {
  const search = String(edit.searchText || "");
  const replace = String(edit.replaceWith || "");
  if (!search) return c;
  let count = 0;

  const slides = c.slides.map((slide) => {
    const shapes = (slide.shapes || [])
      .filter((shape: JsonValue) => shape.type === "html" || shape.type === "shader")
      .map((shape: JsonValue) => {
        if (shape.type !== "html") return shape;
        const result = replaceAllCaseInsensitive(String(shape.htmlContent || ""), search, replace);
        count += result.count;
        return result.count > 0 ? { ...shape, htmlContent: result.text } : shape;
      });
    const updated = { ...slide, shapes };
    return { ...updated, content: deriveSlideContent(updated) };
  });
  return count > 0 ? { ...c, slides } : c;
}

function addHtmlContent(c: PptxContent, edit: EditAction): PptxContent {
  const idx = Number(edit.slideIndex);
  if (idx < 0) return c;
  const htmlContent = String(edit.htmlContent || "").trim();
  if (!htmlContent) return c;
  c = ensureSlides(c, idx + 1);

  const slide = { ...c.slides[idx] };
  const shapes = (slide.shapes || []).filter((s: JsonValue) => s.type !== "html");
  const dims = c.slideDimensions || { width: 12192000, height: 6858000 };
  const pos = (edit.position as StringKeyRecord) || { x: 0, y: 0, cx: dims.width, cy: dims.height };
  shapes.push({
    type: "html",
    transform: pos,
    htmlContent,
    label: String(edit.label || "HTML Content"),
    shapeIndex: nextShapeIndex(slide),
  });
  slide.shapes = shapes;
  slide.content = deriveSlideContent(slide);

  const slides = [...c.slides];
  slides[idx] = slide;
  return { ...c, slides };
}

function addImage(c: PptxContent, edit: EditAction): PptxContent {
  const idx = Number(edit.slideIndex);
  if (idx < 0) return c;
  c = ensureSlides(c, idx + 1);

  const slide = { ...c.slides[idx] };
  const shapes = [...(slide.shapes || [])];
  const pos = (edit.position as StringKeyRecord) || { x: 1500000, y: 1500000, cx: 5000000, cy: 3500000 };
  shapes.push({
    type: "image",
    transform: pos,
    src: String(edit.imageUrl || ""),
    alt: String(edit.altText || ""),
    shapeIndex: nextShapeIndex(slide),
  });
  slide.shapes = shapes;

  const slides = [...c.slides];
  slides[idx] = slide;
  return { ...c, slides };
}

function addTable(c: PptxContent, edit: EditAction): PptxContent {
  const idx = Number(edit.slideIndex);
  if (idx < 0) return c;
  c = ensureSlides(c, idx + 1);
  const table = edit.table as StringKeyRecord | undefined;
  if (!table?.headers) return c;

  const slide = { ...c.slides[idx] };
  const shapes = [...(slide.shapes || [])];
  const pos = (edit.position as StringKeyRecord) || { x: 457200, y: 1600000, cx: 8229600, cy: 3000000 };
  const headers = table.headers as string[];
  const rows = (table.rows as string[][]) || [];
  const style = table.style as StringKeyRecord | undefined;
  shapes.push({
    type: "table",
    transform: pos,
    headers: headers.map((h: string) => ({ text: h, style: style?.header })),
    rows: rows.map((row: string[]) =>
      row.map((cell: string) => ({ text: cell, style: style?.cell })),
    ),
    shapeIndex: nextShapeIndex(slide),
  });
  slide.shapes = shapes;
  slide.content = deriveSlideContent(slide);

  const slides = [...c.slides];
  slides[idx] = slide;
  return { ...c, slides };
}

function setSlideTransition(c: PptxContent, edit: EditAction): PptxContent {
  const idx = Number(edit.slideIndex);
  if (idx < 0) return c;
  c = ensureSlides(c, idx + 1);
  const slides = c.slides.map((s, i) =>
    i === idx ? { ...s, transition: edit.transition } : s,
  );
  return { ...c, slides };
}

// ---------------------------------------------------------------------------
// Handler dispatch
// ---------------------------------------------------------------------------

const HANDLERS: Record<string, (c: PptxContent, edit: EditAction) => PptxContent> = {
  insertSlide,
  deleteSlide,
  deleteSlides,
  reorderSlide,
  updateSlide,
  replaceText,
  setSlideBackground,
  resizeSlides,
  addHtmlContent,
  addImage,
  addTable,
  setSlideTransition,
  // Legacy aliases — kept for edits already stored in DB from older sessions
  insertPptxSlide: insertSlide,
  deletePptxSlide: deleteSlide,
  reorderPptxSlide: reorderSlide,
  updatePptxSlide: updateSlide,
};

/**
 * Apply a batch of edit actions to a PptxContent structure.
 * Returns the modified content. Pure function — no side effects.
 */
export function applyEditsToContent(
  content: PptxContent,
  edits: EditAction[],
): { content: PptxContent; applied: number; skipped: number } {
  let current = content;
  let applied = 0;
  let skipped = 0;

  for (const edit of edits) {
    if (edit.action === "clearChanges") continue;
    const handler = HANDLERS[edit.action];
    if (!handler) {
      console.warn(`[apply-edits] Unknown action: ${edit.action}`);
      skipped++;
      continue;
    }
    try {
      current = handler(current, edit);
      applied++;
    } catch (err) {
      console.warn(`[apply-edits] ${edit.action} failed:`, err);
      skipped++;
    }
  }

  return { content: current, applied, skipped };
}

/**
 * Create an empty PptxContent with default dimensions.
 */
export function createEmptyPptxContent(
  dimensions?: { width: number; height: number },
): PptxContent {
  return {
    slides: [],
    slideDimensions: dimensions || { width: 12192000, height: 6858000 },
  };
}

type EditBatch = { edits?: EditAction[] };

/**
 * Apply queued documentEdits batches to documentContent.
 * Used by the gateway and server materialize path.
 */
export function applyPendingEdits(
  documentContent: PptxContent | null,
  documentEdits: EditBatch[] | null,
): PptxContent {
  const content = documentContent ?? createEmptyPptxContent();

  if (!documentEdits || !Array.isArray(documentEdits) || documentEdits.length === 0) {
    return content;
  }

  const allEdits = documentEdits.flatMap((batch) =>
    Array.isArray(batch.edits) ? batch.edits : [],
  );

  return applyEditsToContent(content, allEdits).content;
}
