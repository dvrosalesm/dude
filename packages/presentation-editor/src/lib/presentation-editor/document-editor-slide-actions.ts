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

export function insertPptxSlide(
  afterSlideIndex: number | null,
  content: string,
): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };

  // Normalize escaped newlines/tabs from agent output
  const normalized = content.replace(/\\n/g, "\n").replace(/\\t/g, "\t");

  const slides = [...c.slides];
  const newSlide: Slide = {
    index: 0,
    uid: `slide-new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content: normalized,
    shapes: [],
    background: "#ffffff",
  };

  const insertAt = afterSlideIndex === null ? 0 : afterSlideIndex + 1;
  slides.splice(insertAt, 0, newSlide);

  // Reindex
  slides.forEach((s, i) => { s.index = i; });

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: "pptx.slides",
    type: "insert",
    oldValue: null,
    newValue: content,
  });

  return { success: true, message: `Inserted new slide at position ${insertAt + 1}.` };
}

export function deletePptxSlide(slideIndex: number): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  if (c.slides.length <= 1) return { success: false, error: "Cannot delete the only slide." };
  if (slideIndex < 0 || slideIndex >= c.slides.length) return { success: false, error: "Invalid slide index." };

  const slides = c.slides.filter((_, i) => i !== slideIndex);
  slides.forEach((s, i) => { s.index = i; });

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: `pptx.slides.${slideIndex}`,
    type: "delete",
    oldValue: null,
    newValue: null,
  });

  return { success: true, message: `Deleted slide ${slideIndex + 1}.` };
}

export function reorderPptxSlide(fromIndex: number, toIndex: number): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  if (fromIndex < 0 || fromIndex >= c.slides.length || toIndex < 0 || toIndex >= c.slides.length) {
    return { success: false, error: "Invalid slide index." };
  }

  const slides = [...c.slides];
  const [moved] = slides.splice(fromIndex, 1);
  slides.splice(toIndex, 0, moved);
  slides.forEach((s, i) => { s.index = i; });

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: "pptx.slides",
    type: "replace",
    oldValue: `position ${fromIndex}`,
    newValue: `position ${toIndex}`,
  });

  return { success: true, message: `Moved slide from position ${fromIndex + 1} to ${toIndex + 1}.` };
}

export function setSlideBackground(slideIndex: number, color: string): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  if (!c.slides[slideIndex]) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const slides = c.slides.map((s, i) =>
    i === slideIndex ? { ...s, background: `#${color.replace(/^#/, "")}` } : s,
  );

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: `pptx.slides.${slideIndex}`,
    type: "replace",
    oldValue: null,
    newValue: `background: #${color}`,
  });

  return { success: true, message: `Set background of slide ${slideIndex + 1} to #${color}.` };
}

export function resizePptxSlides(width: number, height: number): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };

  commitContent({ ...c, slideDimensions: { width, height } });
  recordDocumentChange({
    path: "pptx.slideDimensions",
    type: "replace",
    oldValue: null,
    newValue: `${width}x${height}`,
  });

  return { success: true, message: `Resized slides to ${width}x${height}.` };
}

export function updatePptxSlideContent(slideIndex: number, newContent: string): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  if (!c.slides[slideIndex]) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  // Normalize escaped newlines/tabs from agent output
  const normalized = newContent.replace(/\\n/g, "\n").replace(/\\t/g, "\t");

  const slides = updateSlide(c.slides, slideIndex, (slide) => {
    const dims = c.slideDimensions || { width: 12192000, height: 6858000 };
    const shaderLayers = (slide.shapes || []).filter((shape) => shape.type === "shader");
    const htmlShape: PptxHtmlShape = {
      type: "html",
      transform: { x: 0, y: 0, cx: dims.width, cy: dims.height },
      shapeIndex: nextShapeIndex({ ...slide, shapes: shaderLayers }),
      htmlContent: plainTextToHtml(normalized),
      label: "Slide HTML",
    };
    return { ...slide, shapes: [...shaderLayers, htmlShape] };
  });

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: `pptx.slides.${slideIndex}`,
    type: "replace",
    oldValue: null,
    newValue: newContent,
  });

  return { success: true, message: `Updated slide ${slideIndex + 1}.` };
}
