import type { ChatCanvasPaintState, DrawElementContext } from "./types";

const GLOW = { r: 184, g: 212, b: 235 };

function applyTransform(element: Element, transform: DOMMatrix | string | undefined) {
  if (!transform) return;
  if (element instanceof HTMLElement) {
    element.style.transform =
      typeof transform === "string" ? transform : transform.toString();
  }
}

function clearTransform(element: Element) {
  if (element instanceof HTMLElement) {
    element.style.transform = "";
  }
}

/** Soft background glow only — never filter the text/content itself. */
function drawSoftAmbient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
) {
  const breathe = 0.5 + Math.sin(time * 0.0012) * 0.5;
  const cx = width * 0.5;
  const cy = height * 0.48;
  const radius = Math.max(width, height) * 0.42;

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(
    0,
    `rgba(${GLOW.r}, ${GLOW.g}, ${GLOW.b}, ${0.05 + breathe * 0.04})`,
  );
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function paintChatDreamEffect(
  ctx: DrawElementContext,
  _canvas: HTMLCanvasElement,
  element: Element,
  state: ChatCanvasPaintState,
) {
  const width = _canvas.width;
  const height = _canvas.height;
  if (width === 0 || height === 0) return;

  ctx.clearRect(0, 0, width, height);

  if (state.effect === "none" || state.phase !== "thinking") {
    const transform = ctx.drawElementImage?.(element, 0, 0);
    applyTransform(element, transform);
    return;
  }

  drawSoftAmbient(ctx, width, height, state.time);
  const transform = ctx.drawElementImage?.(element, 0, 0);
  applyTransform(element, transform);
}

export function paintChatDreamEffectFromImage(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  state: ChatCanvasPaintState,
) {
  const width = canvas.width;
  const height = canvas.height;
  if (width === 0 || height === 0) return;

  ctx.clearRect(0, 0, width, height);

  if (state.phase === "thinking") {
    drawSoftAmbient(ctx, width, height, state.time);
  }

  ctx.drawImage(source, 0, 0, width, height);
}

export { clearTransform };
