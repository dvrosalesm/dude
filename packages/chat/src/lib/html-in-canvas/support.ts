import type { DrawElementContext, PaintCanvas } from "./types";

export function supportsHtmlInCanvas(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const canvas = document.createElement("canvas") as PaintCanvas;
    canvas.setAttribute("layoutsubtree", "");
    const ctx = canvas.getContext("2d") as DrawElementContext | null;
    return (
      typeof canvas.requestPaint === "function" &&
      typeof ctx?.drawElementImage === "function"
    );
  } catch {
    return false;
  }
}

export function isElectronDesktop(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(
      (window as Window & { dudeDesktop?: { isDesktop?: boolean } }).dudeDesktop
        ?.isDesktop,
    )
  );
}

/** Desktop compositor: native API or html2canvas capture in Electron. */
export function supportsDesktopCanvasCompositor(): boolean {
  return supportsHtmlInCanvas() || isElectronDesktop();
}

export function asPaintCanvas(canvas: HTMLCanvasElement): PaintCanvas {
  return canvas as PaintCanvas;
}

export function asDrawContext(ctx: CanvasRenderingContext2D): DrawElementContext {
  return ctx as DrawElementContext;
}
