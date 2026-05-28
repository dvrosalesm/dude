"use client";

import { getContent, commitContent, recordDocumentChange } from "./document-editor-mutation";
import type { ApplyEditResult } from "./document-editor-types";
import type {
  PptxContent,
  PptxHtmlShape,
  PptxTextShape,
  PptxImageShape,
  PptxTableShape,
  PptxTableCell,
  PptxSlideShape,
  Slide,
  SlideTransition,
  SlideTransitionType,
} from "@dude/presentation-editor/types";
import {
  deriveSlideContent,
  escapeHtml,
  findShape,
  nextShapeIndex,
  plainTextToHtml,
  replaceAllCaseInsensitive,
  stripHtmlText,
  updateSlide,
} from "./pptx-slide-helpers";

export function replaceTextInPptx(searchText: string, replaceWith: string): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };

  let count = 0;

  const slides = c.slides.map((slide) => {
    const shapes = (slide.shapes || [])
      .filter((shape) => shape.type === "html" || shape.type === "shader")
      .map((shape) => {
        if (shape.type !== "html") return shape;
        const result = replaceAllCaseInsensitive(shape.htmlContent, searchText, replaceWith);
        count += result.count;
        return result.count > 0 ? { ...shape, htmlContent: result.text } : shape;
      });
    const updated = { ...slide, shapes };
    return { ...updated, content: deriveSlideContent(updated) };
  });

  if (count === 0) {
    return { success: false, error: `Text "${searchText}" not found in presentation.` };
  }

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: "pptx.content",
    type: "replace",
    oldValue: searchText,
    newValue: replaceWith,
  });

  return { success: true, message: `Replaced ${count} occurrence(s) of "${searchText}" with "${replaceWith}".` };
}

export type PptxFormattingClient = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
};

export function formatPptxText(
  slideIndex: number,
  searchText: string,
  formatting: PptxFormattingClient,
): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  if (!c.slides[slideIndex]) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const searchLower = searchText.toLowerCase();

  const slides = updateSlide(c.slides, slideIndex, (slide) => {
    const shapes = (slide.shapes || []).map((shape) => {
      if (shape.type !== "text") return shape;
      const paragraphs = shape.paragraphs.map((p) => ({
        ...p,
        runs: p.runs.map((r) => {
          if (!r.text.toLowerCase().includes(searchLower)) return r;
          return {
            ...r,
            ...(formatting.bold !== undefined ? { bold: formatting.bold } : {}),
            ...(formatting.italic !== undefined ? { italic: formatting.italic } : {}),
            ...(formatting.underline !== undefined ? { underline: formatting.underline } : {}),
            ...(formatting.fontSize !== undefined ? { fontSize: formatting.fontSize * 100 } : {}),
            ...(formatting.color !== undefined ? { color: `#${formatting.color.replace(/^#/, "")}` } : {}),
            ...(formatting.fontFamily !== undefined ? { fontFamily: formatting.fontFamily } : {}),
          };
        }),
      }));
      return { ...shape, paragraphs } as PptxTextShape;
    });
    return { ...slide, shapes };
  });

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: `pptx.slides.${slideIndex}`,
    type: "replace",
    oldValue: searchText,
    newValue: `[formatted] ${searchText}`,
  });

  return { success: true, message: `Applied formatting to "${searchText}" on slide ${slideIndex + 1}.` };
}

export function setShapeTextInPptx(
  slideIndex: number,
  shapeIndex: number,
  paragraphs: string[],
): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  const slide = c.slides[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const found = findShape(slide, shapeIndex);
  if (!found || found.shape.type !== "text") return { success: false, error: "Text shape not found." };

  const slides = updateSlide(c.slides, slideIndex, (s) => {
    const shapes = [...(s.shapes || [])];
    shapes[found.pos] = {
      ...found.shape,
      paragraphs: paragraphs.map((text) => ({ runs: [{ text }] })),
    } as PptxTextShape;
    return { ...s, shapes };
  });

  commitContent({ ...c, slides });
  return { success: true, message: "Text updated." };
}

export function setShapeTextAlignInPptx(
  slideIndex: number,
  shapeIndex: number,
  align: string,
): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  const slide = c.slides[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const found = findShape(slide, shapeIndex);
  if (!found || found.shape.type !== "text") return { success: false, error: "Text shape not found." };

  const slides = updateSlide(c.slides, slideIndex, (s) => {
    const shapes = [...(s.shapes || [])];
    shapes[found.pos] = {
      ...found.shape,
      paragraphs: (found.shape as PptxTextShape).paragraphs.map((p) => ({ ...p, align })),
    } as PptxTextShape;
    return { ...s, shapes };
  });

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: `pptx.slides.${slideIndex}.shapes.${shapeIndex}`,
    type: "replace",
    oldValue: null,
    newValue: `textAlign: ${align}`,
  });

  return { success: true, message: `Set text alignment to ${align}.` };
}

export function setShapeFontSizeInPptx(
  slideIndex: number,
  shapeIndex: number,
  fontSize: number,
): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  const slide = c.slides[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const found = findShape(slide, shapeIndex);
  if (!found || found.shape.type !== "text") return { success: false, error: "Text shape not found." };

  const slides = updateSlide(c.slides, slideIndex, (s) => {
    const shapes = [...(s.shapes || [])];
    shapes[found.pos] = {
      ...found.shape,
      paragraphs: (found.shape as PptxTextShape).paragraphs.map((p) => ({
        ...p,
        runs: p.runs.map((r) => ({ ...r, fontSize: fontSize * 100 })),
      })),
    } as PptxTextShape;
    return { ...s, shapes };
  });

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: `pptx.slides.${slideIndex}.shapes.${shapeIndex}`,
    type: "replace",
    oldValue: null,
    newValue: `fontSize: ${fontSize}pt`,
  });

  return { success: true, message: `Changed font size to ${fontSize}pt.` };
}

export function setShapeFontInPptx(
  slideIndex: number,
  shapeIndex: number,
  fontFamily: string,
): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  const slide = c.slides[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const found = findShape(slide, shapeIndex);
  if (!found || found.shape.type !== "text") return { success: false, error: "Text shape not found." };

  const slides = updateSlide(c.slides, slideIndex, (s) => {
    const shapes = [...(s.shapes || [])];
    shapes[found.pos] = {
      ...found.shape,
      paragraphs: (found.shape as PptxTextShape).paragraphs.map((p) => ({
        ...p,
        runs: p.runs.map((r) => ({ ...r, fontFamily })),
      })),
    } as PptxTextShape;
    return { ...s, shapes };
  });

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: `pptx.slides.${slideIndex}.shapes.${shapeIndex}`,
    type: "replace",
    oldValue: null,
    newValue: `font: ${fontFamily}`,
  });

  return { success: true, message: `Changed font to ${fontFamily}.` };
}

export function setShapeTextColorInPptx(
  slideIndex: number,
  shapeIndex: number,
  color: string,
): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  const slide = c.slides[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const found = findShape(slide, shapeIndex);
  if (!found || found.shape.type !== "text") return { success: false, error: "Text shape not found." };

  const hexColor = `#${color.replace(/^#/, "")}`;

  const slides = updateSlide(c.slides, slideIndex, (s) => {
    const shapes = [...(s.shapes || [])];
    shapes[found.pos] = {
      ...found.shape,
      paragraphs: (found.shape as PptxTextShape).paragraphs.map((p) => ({
        ...p,
        runs: p.runs.map((r) => ({ ...r, color: hexColor })),
      })),
    } as PptxTextShape;
    return { ...s, shapes };
  });

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: `pptx.slides.${slideIndex}.shapes.${shapeIndex}`,
    type: "replace",
    oldValue: null,
    newValue: `text color: ${color}`,
  });

  return { success: true, message: `Changed text color to ${color}.` };
}

// ==================== Shape-Level Operations ====================
