import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { DudeFaceMode } from "./dude-face-paths.js";

type LayerValues = {
  opacity: number;
  scaleX: number;
  scaleY: number;
};

type OpenEyeValues = {
  opacity: number;
  scale: number;
};

type FaceMotionValues = {
  leftClosed: LayerValues;
  rightClosed: LayerValues;
  leftOpen: OpenEyeValues;
  rightOpen: OpenEyeValues;
  mouthOpacity: number;
};

type FaceRefs = {
  leftClosed: RefObject<SVGPathElement | null>;
  rightClosed: RefObject<SVGPathElement | null>;
  leftOpen: RefObject<SVGGElement | null>;
  rightOpen: RefObject<SVGGElement | null>;
  mouth: RefObject<SVGPathElement | null>;
};

const TARGETS: Record<DudeFaceMode, FaceMotionValues> = {
  idle: {
    leftClosed: { opacity: 1, scaleX: 1, scaleY: 1 },
    rightClosed: { opacity: 1, scaleX: 1, scaleY: 1 },
    leftOpen: { opacity: 0, scale: 0.35 },
    rightOpen: { opacity: 0, scale: 0.35 },
    mouthOpacity: 0.55,
  },
  listening: {
    leftClosed: { opacity: 1, scaleX: 1, scaleY: 1 },
    rightClosed: { opacity: 0, scaleX: 0.82, scaleY: 0.45 },
    leftOpen: { opacity: 0, scale: 0.35 },
    rightOpen: { opacity: 1, scale: 1 },
    mouthOpacity: 0.85,
  },
  thinking: {
    leftClosed: { opacity: 0, scaleX: 0.88, scaleY: 0.42 },
    rightClosed: { opacity: 0, scaleX: 0.88, scaleY: 0.42 },
    leftOpen: { opacity: 1, scale: 1 },
    rightOpen: { opacity: 1, scale: 1 },
    mouthOpacity: 0.7,
  },
};

const THINK_EYE_LARGE = 1.12;
const THINK_EYE_SMALL = 0.52;
const THINK_EYE_SPEED = 3.2;

function cloneTarget(mode: DudeFaceMode): FaceMotionValues {
  const target = TARGETS[mode];
  return {
    mouthOpacity: target.mouthOpacity,
    leftClosed: { ...target.leftClosed },
    rightClosed: { ...target.rightClosed },
    leftOpen: { ...target.leftOpen },
    rightOpen: { ...target.rightOpen },
  };
}

function lerp(a: number, b: number, alpha: number) {
  return a + (b - a) * alpha;
}

function lerpLayer(prev: LayerValues, next: LayerValues, alpha: number): LayerValues {
  return {
    opacity: lerp(prev.opacity, next.opacity, alpha),
    scaleX: lerp(prev.scaleX, next.scaleX, alpha),
    scaleY: lerp(prev.scaleY, next.scaleY, alpha),
  };
}

function lerpOpen(prev: OpenEyeValues, next: OpenEyeValues, alpha: number): OpenEyeValues {
  return {
    opacity: lerp(prev.opacity, next.opacity, alpha),
    scale: lerp(prev.scale, next.scale, alpha),
  };
}

function setSvgOpacity(el: SVGGraphicsElement | null, opacity: number) {
  if (!el) return;
  const clamped = Math.max(0, Math.min(1, opacity));
  const value = String(clamped);
  el.setAttribute("opacity", value);
  el.style.opacity = value;
  if (clamped < 0.04) {
    el.setAttribute("visibility", "hidden");
    el.setAttribute("display", "none");
  } else {
    el.setAttribute("visibility", "visible");
    el.removeAttribute("display");
  }
}

function applyClosed(el: SVGGraphicsElement | null, layer: LayerValues) {
  if (!el) return;
  setSvgOpacity(el, layer.opacity);
  el.setAttribute("transform", `scale(${layer.scaleX} ${layer.scaleY})`);
}

function applyOpen(el: SVGGElement | null, layer: OpenEyeValues) {
  if (!el) return;
  setSvgOpacity(el, layer.opacity);
  el.setAttribute("transform", `scale(${layer.scale})`);
}

function stepValues(
  current: FaceMotionValues,
  mode: DudeFaceMode,
  smooth: number,
): FaceMotionValues {
  const target = TARGETS[mode];
  const next = { ...current };

  next.leftClosed = lerpLayer(current.leftClosed, target.leftClosed, smooth);
  next.rightClosed = lerpLayer(current.rightClosed, target.rightClosed, smooth);

  if (mode === "thinking") {
    next.leftOpen = {
      opacity: lerp(current.leftOpen.opacity, target.leftOpen.opacity, smooth),
      scale: current.leftOpen.scale,
    };
    next.rightOpen = {
      opacity: lerp(current.rightOpen.opacity, target.rightOpen.opacity, smooth),
      scale: current.rightOpen.scale,
    };
  } else {
    next.leftOpen = lerpOpen(current.leftOpen, target.leftOpen, smooth);
    next.rightOpen = lerpOpen(current.rightOpen, target.rightOpen, smooth);
  }

  next.mouthOpacity = lerp(current.mouthOpacity, target.mouthOpacity, smooth);
  return next;
}

function decorateFrame(
  mode: DudeFaceMode,
  frame: FaceMotionValues,
  tSec: number,
  decorative: boolean,
): FaceMotionValues {
  const target = TARGETS[mode];
  const leftClosed = { ...frame.leftClosed };
  const rightClosed = { ...frame.rightClosed };
  const leftOpen = { ...frame.leftOpen };
  const rightOpen = { ...frame.rightOpen };
  let mouthOpacity = frame.mouthOpacity;

  if (mode === "thinking" && frame.leftOpen.opacity > 0.35) {
    const wave = 0.5 + 0.5 * Math.sin(tSec * THINK_EYE_SPEED);
    leftOpen.scale = lerp(THINK_EYE_LARGE, THINK_EYE_SMALL, wave);
    rightOpen.scale = lerp(THINK_EYE_SMALL, THINK_EYE_LARGE, wave);
    if (decorative) {
      const pulse = 0.5 + 0.5 * Math.sin(tSec * 2.4);
      mouthOpacity = lerp(
        mouthOpacity,
        target.mouthOpacity * (0.72 + pulse * 0.28),
        0.35,
      );
    }
    return {
      ...frame,
      leftClosed,
      rightClosed,
      leftOpen,
      rightOpen,
      mouthOpacity,
    };
  }

  if (mode === "idle") {
    const breathe = 1 + Math.sin(tSec * 2.2) * 0.1;
    leftClosed.scaleX *= breathe;
    leftClosed.scaleY *= breathe;
    rightClosed.scaleX *= breathe;
    rightClosed.scaleY *= breathe;
    const pulse = 0.5 + 0.5 * Math.sin(tSec * 2.4);
    mouthOpacity = decorative
      ? lerp(mouthOpacity, target.mouthOpacity * (0.68 + pulse * 0.32), 0.35)
      : lerp(mouthOpacity, target.mouthOpacity, 0.2);
  } else if (mode === "listening" && frame.rightOpen.opacity > 0.35) {
    const breathe = 1 + Math.sin(tSec * 3.4) * 0.1;
    rightOpen.scale = frame.rightOpen.scale * breathe;
    const pulse = 0.5 + 0.5 * Math.sin(tSec * 2.4);
    mouthOpacity = decorative
      ? lerp(mouthOpacity, target.mouthOpacity * (0.75 + pulse * 0.25), 0.35)
      : lerp(mouthOpacity, target.mouthOpacity, 0.2);
  }

  return {
    ...frame,
    leftClosed,
    rightClosed,
    leftOpen,
    rightOpen,
    mouthOpacity,
  };
}

function paintFrame(frame: FaceMotionValues, refs: FaceRefs) {
  applyClosed(refs.leftClosed.current, frame.leftClosed);
  applyClosed(refs.rightClosed.current, frame.rightClosed);
  applyOpen(refs.leftOpen.current, frame.leftOpen);
  applyOpen(refs.rightOpen.current, frame.rightOpen);
  setSvgOpacity(refs.mouth.current, frame.mouthOpacity);
}

export function useAgentFaceMotion(
  state: DudeFaceMode,
  decorativeMotion: boolean,
  refs: FaceRefs,
) {
  const valuesRef = useRef<FaceMotionValues>(cloneTarget(state));
  const stateRef = useRef(state);
  const decorativeRef = useRef(decorativeMotion);
  const startRef = useRef(0);
  const boostFramesRef = useRef(0);
  const refsRef = useRef(refs);

  refsRef.current = refs;

  useEffect(() => {
    stateRef.current = state;
    boostFramesRef.current = 24;
  }, [state]);

  useEffect(() => {
    decorativeRef.current = decorativeMotion;
  }, [decorativeMotion]);

  useLayoutEffect(() => {
    startRef.current = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const mode = stateRef.current;
      const tSec = (now - startRef.current) / 1000;
      const boost = boostFramesRef.current > 0;
      const smooth = boost ? 0.38 : mode === "thinking" ? 0.24 : 0.2;
      if (boost) boostFramesRef.current -= 1;

      valuesRef.current = stepValues(valuesRef.current, mode, smooth);
      const frame = decorateFrame(
        mode,
        valuesRef.current,
        tSec,
        decorativeRef.current,
      );
      paintFrame(frame, refsRef.current);

      raf = requestAnimationFrame(tick);
    };

    tick(performance.now());
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, []);
}
