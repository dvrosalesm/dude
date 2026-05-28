/** Experimental HTML-in-Canvas API (Chromium + canvas-draw-element flag). */

export type DrawElementContext = CanvasRenderingContext2D & {
  drawElement?: (
    element: Element,
    x: number,
    y: number,
    options?: { width?: number; height?: number },
  ) => DOMMatrix | string;
  drawElementImage?: (
    element: Element,
    x: number,
    y: number,
    options?: { width?: number; height?: number },
  ) => DOMMatrix | string;
};

export type PaintCanvas = HTMLCanvasElement & {
  onpaint: ((this: HTMLCanvasElement) => void) | null;
  requestPaint: () => void;
};

export type ChatCanvasEffect = "dream" | "none";

export type DreamPhase = "idle" | "thinking" | "revealing";

export type ChatCanvasPaintState = {
  phase: DreamPhase;
  time: number;
  effect: ChatCanvasEffect;
  /** 0–1 bloom-in progress when phase is revealing */
  revealProgress: number;
};
