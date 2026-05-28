import type { PptxSlideShape, Slide } from "@dude/presentation-editor/types";

export function deriveSlideContent(slide: Slide): string {
  const parts: string[] = [];
  for (const shape of slide.shapes || []) {
    if (shape.type === "html") {
      parts.push(stripHtmlText(shape.htmlContent));
    } else if (shape.type === "text") {
      for (const p of shape.paragraphs) {
        parts.push(p.runs.map((r) => r.text).join(""));
      }
    } else if (shape.type === "table") {
      parts.push(shape.headers.map((h) => h.text).join("\t"));
      for (const row of shape.rows) {
        parts.push(row.map((c) => c.text).join("\t"));
      }
    }
  }
  return parts.join("\n");
}

export function stripHtmlText(html: string): string {
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

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function plainTextToHtml(text: string): string {
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

export function replaceAllCaseInsensitive(
  value: string,
  search: string,
  replacement: string,
): { text: string; count: number } {
  const searchLower = search.toLowerCase();
  const lower = value.toLowerCase();
  if (!searchLower || !lower.includes(searchLower)) {
    return { text: value, count: 0 };
  }

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

export function nextShapeIndex(slide: Slide): number {
  let max = -1;
  for (const s of slide.shapes || []) max = Math.max(max, s.shapeIndex);
  return max + 1;
}

export function updateSlide(
  slides: Slide[],
  idx: number,
  updater: (slide: Slide) => Slide,
): Slide[] {
  return slides.map((s, i) => {
    if (i !== idx) return s;
    const updated = updater(s);
    return { ...updated, content: deriveSlideContent(updated) };
  });
}

export function findShape(
  slide: Slide,
  shapeIndex: number,
): { shape: PptxSlideShape; pos: number } | null {
  const shapes = slide.shapes || [];
  const pos = shapes.findIndex((s) => s.shapeIndex === shapeIndex);
  if (pos === -1) return null;
  return { shape: shapes[pos], pos };
}
