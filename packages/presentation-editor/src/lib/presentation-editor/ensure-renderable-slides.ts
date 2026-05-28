import type { PptxContent, PptxSlideShape, Slide } from "@dude/presentation-editor/types";
import { plainTextToHtml } from "./pptx-slide-helpers";

function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text.trim());
}

function textShapeToPlain(shape: PptxSlideShape): string {
  if (shape.type !== "text") return "";
  const paragraphs = shape.paragraphs || [];
  return paragraphs
    .map((p) => (p.runs || []).map((r) => r.text).join(""))
    .join("\n")
    .trim();
}

function fullSlideHtmlShape(
  slide: Slide,
  htmlContent: string,
  dims: { width: number; height: number },
): PptxSlideShape {
  return {
    type: "html",
    transform: { x: 0, y: 0, cx: dims.width, cy: dims.height },
    htmlContent,
    label: "Slide HTML",
    shapeIndex: 0,
  };
}

/** Ensure each slide has html/shader/image/table shapes the canvas can render. */
export function ensureRenderableSlide(
  slide: Slide,
  dims: { width: number; height: number },
): Slide {
  const kept = (slide.shapes || []).filter(
    (shape) =>
      shape.type === "shader" ||
      shape.type === "image" ||
      shape.type === "table" ||
      (shape.type === "html" && String(shape.htmlContent || "").trim().length > 0),
  );

  const hasHtml = kept.some((shape) => shape.type === "html");
  if (hasHtml) {
    return { ...slide, shapes: kept };
  }

  const content = String(slide.content || "").trim();
  if (content && looksLikeHtml(content)) {
    return {
      ...slide,
      shapes: [...kept.filter((s) => s.type !== "html"), fullSlideHtmlShape(slide, content, dims)],
    };
  }

  const textParts = (slide.shapes || [])
    .filter((shape) => shape.type === "text")
    .map(textShapeToPlain)
    .filter(Boolean);
  if (textParts.length > 0) {
    const plain = textParts.join("\n");
    const htmlContent = looksLikeHtml(plain) ? plain : plainTextToHtml(plain);
    return {
      ...slide,
      shapes: [...kept, fullSlideHtmlShape(slide, htmlContent, dims)],
    };
  }

  if (content) {
    const htmlContent = looksLikeHtml(content) ? content : plainTextToHtml(content);
    return {
      ...slide,
      shapes: [...kept, fullSlideHtmlShape(slide, htmlContent, dims)],
    };
  }

  return { ...slide, shapes: kept };
}

export function ensureRenderableSlides(content: PptxContent): PptxContent {
  const dims = content.slideDimensions || { width: 12192000, height: 6858000 };
  return {
    ...content,
    slides: (content.slides || []).map((slide) => ensureRenderableSlide(slide, dims)),
  };
}
