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

export function moveShapeInPptx(
  slideIndex: number,
  shapeIndex: number,
  x: number,
  y: number,
  cx: number,
  cy: number,
): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  const slide = c.slides[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const found = findShape(slide, shapeIndex);
  if (!found) return { success: false, error: "Shape not found." };

  const slides = updateSlide(c.slides, slideIndex, (s) => {
    const shapes = [...(s.shapes || [])];
    shapes[found.pos] = { ...found.shape, transform: { ...found.shape.transform, x, y, cx, cy } };
    return { ...s, shapes };
  });

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: `pptx.slides.${slideIndex}.shapes.${shapeIndex}`,
    type: "replace",
    oldValue: null,
    newValue: `moved to (${x}, ${y})`,
  });

  return { success: true, message: `Moved shape on slide ${slideIndex + 1}.` };
}

export function setShapeFillInPptx(
  slideIndex: number,
  shapeIndex: number,
  color: string,
): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  const slide = c.slides[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const found = findShape(slide, shapeIndex);
  if (!found) return { success: false, error: "Shape not found." };

  const slides = updateSlide(c.slides, slideIndex, (s) => {
    const shapes = [...(s.shapes || [])];
    shapes[found.pos] = { ...found.shape, fill: { type: "solid", color: `#${color.replace(/^#/, "")}` } };
    return { ...s, shapes };
  });

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: `pptx.slides.${slideIndex}.shapes.${shapeIndex}`,
    type: "replace",
    oldValue: null,
    newValue: `fill: ${color}`,
  });

  return { success: true, message: `Changed shape fill to ${color}.` };
}

export function deleteShapeInPptx(
  slideIndex: number,
  shapeIndex: number,
): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  const slide = c.slides[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const found = findShape(slide, shapeIndex);
  if (!found) return { success: false, error: "Shape not found." };

  const slides = updateSlide(c.slides, slideIndex, (s) => {
    const shapes = (s.shapes || []).filter((_, i) => i !== found.pos);
    return { ...s, shapes };
  });

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: `pptx.slides.${slideIndex}.shapes.${shapeIndex}`,
    type: "delete",
    oldValue: "shape",
    newValue: null,
  });

  return { success: true, message: `Deleted shape from slide ${slideIndex + 1}.` };
}

export function reorderShapeInPptx(
  slideIndex: number,
  shapeIndex: number,
  targetIndex: number,
): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  const slide = c.slides[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const found = findShape(slide, shapeIndex);
  if (!found) return { success: false, error: "Shape not found." };

  const slides = updateSlide(c.slides, slideIndex, (s) => {
    const shapes = [...(s.shapes || [])];
    const [moved] = shapes.splice(found.pos, 1);
    const targetPos = shapes.findIndex((sh) => sh.shapeIndex === targetIndex);
    shapes.splice(targetPos >= 0 ? targetPos : shapes.length, 0, moved);
    // Reindex
    shapes.forEach((sh, i) => { (sh as { shapeIndex: number }).shapeIndex = i; });
    return { ...s, shapes };
  });

  commitContent({ ...c, slides });
  return { success: true, message: `Reordered shape on slide ${slideIndex + 1}.` };
}

// ==================== Add Shape Operations ====================

export function addTextBoxToPptx(
  slideIndex: number,
  text?: string,
  position?: { x: number; y: number; cx: number; cy: number },
): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  const slide = c.slides[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const transform = position
    ? { x: position.x, y: position.y, cx: position.cx, cy: position.cy }
    : { x: 2438400, y: 2286000, cx: 3657600, cy: 914400 };

  const newShape: PptxTextShape = {
    type: "text",
    transform,
    paragraphs: [{ runs: [{ text: text || "Sample text" }] }],
    shapeIndex: nextShapeIndex(slide),
  };

  const slides = updateSlide(c.slides, slideIndex, (s) => ({
    ...s,
    shapes: [...(s.shapes || []), newShape],
  }));

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: `pptx.slides.${slideIndex}.shapes`,
    type: "replace",
    oldValue: null,
    newValue: "Added text box",
  });

  return { success: true, message: "Text box added." };
}

export function addRectangleToPptx(
  slideIndex: number,
  fillColor?: string,
  position?: { x: number; y: number; cx: number; cy: number },
): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  const slide = c.slides[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const transform = position
    ? { x: position.x, y: position.y, cx: position.cx, cy: position.cy }
    : { x: 2438400, y: 1828800, cx: 3657600, cy: 2743200 };

  const color = fillColor ? `#${fillColor.replace(/^#/, "")}` : "#D9D9D9";
  const newShape: PptxTextShape = {
    type: "text",
    transform,
    paragraphs: [{ runs: [{ text: "" }] }],
    shapeIndex: nextShapeIndex(slide),
    fill: { type: "solid", color },
  };

  const slides = updateSlide(c.slides, slideIndex, (s) => ({
    ...s,
    shapes: [...(s.shapes || []), newShape],
  }));

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: `pptx.slides.${slideIndex}.shapes`,
    type: "replace",
    oldValue: null,
    newValue: "Added rectangle",
  });

  return { success: true, message: "Rectangle added." };
}

export function addLineToPptx(
  slideIndex: number,
  options?: { endMarker?: "none" | "arrow" | "triangle"; color?: string; strokeWidth?: number },
  position?: { x: number; y: number; cx: number; cy: number },
): ApplyEditResult {
  const c = getContent();
  if (!c) return { success: false, error: "No PPTX document loaded." };
  const slide = c.slides[slideIndex];
  if (!slide) return { success: false, error: `Slide ${slideIndex + 1} not found.` };

  const transform = position
    ? { x: position.x, y: position.y, cx: position.cx, cy: position.cy }
    : { x: 2438400, y: 3429000, cx: 4572000, cy: 0 };

  const newShape = {
    type: "line" as const,
    transform,
    shapeIndex: nextShapeIndex(slide),
    color: options?.color || "#333333",
    strokeWidth: options?.strokeWidth || 2,
    endMarker: options?.endMarker || "none",
    startMarker: "none" as const,
  };

  const slides = updateSlide(c.slides, slideIndex, (s) => ({
    ...s,
    shapes: [...(s.shapes || []), newShape],
  }));

  commitContent({ ...c, slides });
  recordDocumentChange({
    path: `pptx.slides.${slideIndex}.shapes`,
    type: "replace",
    oldValue: null,
    newValue: options?.endMarker === "arrow" ? "Added arrow" : "Added line",
  });

  return { success: true, message: options?.endMarker === "arrow" ? "Arrow added." : "Line added." };
}

// ==================== Table Operations ====================

export type PptxTableStyle = {
  headerBgColor?: string;
  headerTextColor?: string;
  borderColor?: string;
  fontSize?: number;
};
