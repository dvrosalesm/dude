export type DocumentType = "pptx";

export type PptxTextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
};

export type PptxTextParagraph = {
  runs: PptxTextRun[];
  align?: string;
};

export type PptxShapeTransform = {
  x: number;
  y: number;
  cx: number;
  cy: number;
  rot?: number;
  flipH?: boolean;
  flipV?: boolean;
};

export type PptxShapeFill =
  | { type: "solid"; color: string }
  | { type: "none" };

export type PptxImageShape = {
  type: "image";
  transform: PptxShapeTransform;
  data: string;
  shapeIndex: number;
  fill?: PptxShapeFill;
  hidden?: boolean;
};

export type PptxTextShape = {
  type: "text";
  transform: PptxShapeTransform;
  paragraphs: PptxTextParagraph[];
  shapeIndex: number;
  fill?: PptxShapeFill;
  hidden?: boolean;
};

export type PptxTableCell = {
  text: string;
  bold?: boolean;
  fontSize?: number;
  color?: string;
  bgColor?: string;
};

export type PptxTableShape = {
  type: "table";
  transform: PptxShapeTransform;
  headers: PptxTableCell[];
  rows: PptxTableCell[][];
  shapeIndex: number;
  fill?: PptxShapeFill;
  hidden?: boolean;
};

export type PptxShaderShape = {
  type: "shader";
  transform: PptxShapeTransform;
  shapeIndex: number;
  fill?: PptxShapeFill;
  hidden?: boolean;
  /** GLSL fragment shader source */
  fragment: string;
  seed: number;
  customUniforms?: Record<string, number>;
  /** Base64 data URL for texture (e.g. "data:image/jpeg;base64,...") */
  textureDataUrl?: string;
};

/** Interactive HTML/CSS/JS content rendered in a sandboxed iframe overlay. */
export type PptxHtmlShape = {
  type: "html";
  transform: PptxShapeTransform;
  shapeIndex: number;
  fill?: PptxShapeFill;
  hidden?: boolean;
  /** Full HTML document (can include <style> and <script> tags). */
  htmlContent: string;
  /** Optional label shown in the editor shape list. */
  label?: string;
};

export type PptxLineShape = {
  type: "line";
  transform: PptxShapeTransform;
  shapeIndex: number;
  fill?: PptxShapeFill;
  hidden?: boolean;
  /** Line color (hex with #) */
  color?: string;
  /** Line width in pt */
  strokeWidth?: number;
  /** "none" | "arrow" | "triangle" for end marker */
  endMarker?: "none" | "arrow" | "triangle";
  /** "none" | "arrow" | "triangle" for start marker */
  startMarker?: "none" | "arrow" | "triangle";
};

export type PptxSlideShape = PptxImageShape | PptxTextShape | PptxTableShape | PptxShaderShape | PptxHtmlShape | PptxLineShape;

/** Check if a shape is client-only (not stored in the PPTX binary). */
export function isClientOnlyShape(shape: PptxSlideShape): boolean {
  return shape.type === "shader" || shape.type === "html";
}

/** Slide transition effect applied when navigating between slides. */
export type SlideTransitionType =
  | "none"
  | "fade"
  | "slide-left"
  | "slide-right"
  | "slide-up"
  | "slide-down"
  | "zoom-in"
  | "zoom-out"
  | "morph"
  | "flip"
  | "rotate"
  | "blur"
  | "bounce"
  | "cube"
  | "swirl";

export type SlideTransition = {
  type: SlideTransitionType;
  /** Duration in milliseconds (default 500). */
  durationMs?: number;
  /** Easing function (default "ease-in-out"). */
  easing?: string;
};

export type Slide = {
  index: number;
  /** Stable identity that survives reordering (assigned client-side). */
  uid?: string;
  content: string;
  notes?: string;
  /** All shapes on this slide. Array position determines visual z-order (later = on top). */
  shapes?: PptxSlideShape[];
  background?: string;
  /** Transition effect when navigating TO this slide. */
  transition?: SlideTransition;
};

export type PptxSlideDimensions = {
  width: number;
  height: number;
};

export type PptxContent = {
  originalBase64: string;
  currentBase64: string;
  textContent: string;
  slides: Slide[];
  fullHtml?: string;
  slideDimensions?: PptxSlideDimensions;
};

export type DocumentContent = PptxContent;

export type Change = {
  id: string;
  path: string;
  type: "insert" | "delete" | "replace";
  oldValue?: unknown;
  newValue?: unknown;
  timestamp: string;
};

export type Revision = {
  id: string;
  label: string;
  content: DocumentContent;
  changes: Change[];
  timestamp: string;
};

export type DocumentState = {
  id: string;
  name: string;
  type: DocumentType;
  originalFile?: File;
  content: DocumentContent;
  changes: Change[];
};
