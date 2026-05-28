"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShaderCanvas } from "./shader-canvas";
import type {
  Slide,
  PptxSlideDimensions,
  SlideTransitionType,
} from "@dude/presentation-editor/types";

/**
 * Ensure HTML content fills the full iframe, never overflows, and proxies
 * external assets through our asset-proxy to avoid CORS.
 */
function ensureFullCanvasHtml(html: string): string {
  const containmentStyle = `<style data-slide-fix>
html,body{height:100%!important;max-width:100%!important;overflow:hidden!important}
body{min-height:100vh!important}
*{box-sizing:border-box!important}
</style>`;

  const proxyScript = `<script data-slide-fix>
(function(){try{
  document.addEventListener('DOMContentLoaded',function(){
    document.querySelectorAll('model-viewer[src]').forEach(function(el){
      var s=el.getAttribute('src');
      if(s&&/^https?:\\/\\//.test(s)){el.setAttribute('src',s);}
    });
  });
  document.addEventListener('keydown',function(e){
    if(['ArrowLeft','ArrowRight','Escape',' '].indexOf(e.key)>=0){
      parent.postMessage({type:'slide-nav-key',key:e.key},'*');
    }
  });
}catch(e){}})();
</script>`;

  const injection = containmentStyle + proxyScript;

  if (html.includes("<!DOCTYPE") || html.includes("<html")) {
    if (html.includes("</head>")) {
      return html.replace("</head>", `${injection}</head>`);
    }
    if (html.includes("<head>")) {
      return html.replace("<head>", `<head>${injection}`);
    }
    return html.replace(/<html[^>]*>/i, (match) => `${match}<head>${injection}</head>`);
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
${injection}
<style>*{margin:0}html,body{height:100%}body{min-height:100vh;display:flex;flex-direction:column;font-family:system-ui,sans-serif;background:#0a0a0a;color:#fafafa;overflow:hidden}</style>
</head><body>${html}</body></html>`;
}

type PresentationModeProps = {
  slides: Slide[];
  onClose: () => void;
  startSlide?: number;
  slideDimensions?: PptxSlideDimensions;
};

// ---------------------------------------------------------------------------
// Slide renderer — shape-based, same as overview/edit views
// ---------------------------------------------------------------------------

function PresentationSlide({
  slide,
  dims,
}: {
  slide: Slide;
  dims: PptxSlideDimensions;
}) {
  const shapes = (slide.shapes || []).filter((shape) => shape.type === "html" || shape.type === "shader");

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        background: slide.background || "#000000",
        containerType: "inline-size",
      }}
    >
      {shapes.map((shape, arrayIdx) => {
        const left = (shape.transform.x / dims.width) * 100;
        const top = (shape.transform.y / dims.height) * 100;
        const width = (shape.transform.cx / dims.width) * 100;
        const height = (shape.transform.cy / dims.height) * 100;
        const fillStyle =
          shape.fill?.type === "solid" ? { background: shape.fill.color } : {};

        return (
          <div
            key={shape.shapeIndex}
            className="absolute overflow-hidden"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
              zIndex: arrayIdx + 1,
              ...fillStyle,
            }}
          >
            {shape.type === "shader" && (
              <ShaderCanvas
                fragment={shape.fragment}
                seed={shape.seed}
                customUniforms={shape.customUniforms}
                textureUrl={shape.textureDataUrl}
                animate
                width={1920}
                height={1080}
                className="w-full h-full pointer-events-none"
              />
            )}
            {shape.type === "html" && (
              <iframe
                srcDoc={ensureFullCanvasHtml(shape.htmlContent)}
                sandbox="allow-scripts"
                className="w-full h-full border-0"
                style={{ pointerEvents: "auto" }}
                title={shape.label || "HTML content"}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Reference render width — the slide is rendered at this fixed pixel width
 * and then CSS-scaled to fill the viewport. This guarantees identical text
 * rendering to the overview/edit views regardless of screen size.
 */
const REFERENCE_WIDTH = 960;

// ---------------------------------------------------------------------------
// Transition animations
// ---------------------------------------------------------------------------

function getTransitionKeyframes(
  type: SlideTransitionType,
  direction: "forward" | "backward",
): { enter: string; exit: string } | null {
  switch (type) {
    case "none":
      return null;
    case "fade":
      return {
        enter: "animate-[fade-in_var(--transition-duration)_var(--transition-easing)_forwards]",
        exit: "animate-[fade-out_var(--transition-duration)_var(--transition-easing)_forwards]",
      };
    case "slide-left":
    case "slide-right": {
      const goLeft = (type === "slide-left") === (direction === "forward");
      return {
        enter: goLeft
          ? "animate-[slide-in-left_var(--transition-duration)_var(--transition-easing)_forwards]"
          : "animate-[slide-in-right_var(--transition-duration)_var(--transition-easing)_forwards]",
        exit: goLeft
          ? "animate-[slide-out-left_var(--transition-duration)_var(--transition-easing)_forwards]"
          : "animate-[slide-out-right_var(--transition-duration)_var(--transition-easing)_forwards]",
      };
    }
    case "slide-up":
    case "slide-down": {
      const goUp = (type === "slide-up") === (direction === "forward");
      return {
        enter: goUp
          ? "animate-[slide-in-up_var(--transition-duration)_var(--transition-easing)_forwards]"
          : "animate-[slide-in-down_var(--transition-duration)_var(--transition-easing)_forwards]",
        exit: goUp
          ? "animate-[slide-out-up_var(--transition-duration)_var(--transition-easing)_forwards]"
          : "animate-[slide-out-down_var(--transition-duration)_var(--transition-easing)_forwards]",
      };
    }
    case "zoom-in":
      return {
        enter: "animate-[zoom-in_var(--transition-duration)_var(--transition-easing)_forwards]",
        exit: "animate-[fade-out_var(--transition-duration)_var(--transition-easing)_forwards]",
      };
    case "zoom-out":
      return {
        enter: "animate-[zoom-out-enter_var(--transition-duration)_var(--transition-easing)_forwards]",
        exit: "animate-[zoom-out-exit_var(--transition-duration)_var(--transition-easing)_forwards]",
      };
    case "flip":
      return {
        enter: "animate-[flip-in_var(--transition-duration)_var(--transition-easing)_forwards]",
        exit: "animate-[flip-out_var(--transition-duration)_var(--transition-easing)_forwards]",
      };
    case "blur":
      return {
        enter: "animate-[blur-in_var(--transition-duration)_var(--transition-easing)_forwards]",
        exit: "animate-[blur-out_var(--transition-duration)_var(--transition-easing)_forwards]",
      };
    default:
      // morph, rotate, bounce, cube, swirl — use fade as fallback
      return {
        enter: "animate-[fade-in_var(--transition-duration)_var(--transition-easing)_forwards]",
        exit: "animate-[fade-out_var(--transition-duration)_var(--transition-easing)_forwards]",
      };
  }
}

const TRANSITION_KEYFRAMES = `
@keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes fade-out { from { opacity: 1 } to { opacity: 0 } }
@keyframes slide-in-left { from { transform: translateX(100%) } to { transform: translateX(0) } }
@keyframes slide-out-left { from { transform: translateX(0) } to { transform: translateX(-100%) } }
@keyframes slide-in-right { from { transform: translateX(-100%) } to { transform: translateX(0) } }
@keyframes slide-out-right { from { transform: translateX(0) } to { transform: translateX(100%) } }
@keyframes slide-in-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
@keyframes slide-out-up { from { transform: translateY(0) } to { transform: translateY(-100%) } }
@keyframes slide-in-down { from { transform: translateY(-100%) } to { transform: translateY(0) } }
@keyframes slide-out-down { from { transform: translateY(0) } to { transform: translateY(100%) } }
@keyframes zoom-in { from { opacity: 0; transform: scale(0.5) } to { opacity: 1; transform: scale(1) } }
@keyframes zoom-out-enter { from { opacity: 0; transform: scale(1.5) } to { opacity: 1; transform: scale(1) } }
@keyframes zoom-out-exit { from { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(0.5) } }
@keyframes flip-in { from { opacity: 0; transform: perspective(800px) rotateY(-90deg) } to { opacity: 1; transform: perspective(800px) rotateY(0) } }
@keyframes flip-out { from { opacity: 1; transform: perspective(800px) rotateY(0) } to { opacity: 0; transform: perspective(800px) rotateY(90deg) } }
@keyframes blur-in { from { opacity: 0; filter: blur(20px) } to { opacity: 1; filter: blur(0) } }
@keyframes blur-out { from { opacity: 1; filter: blur(0) } to { opacity: 0; filter: blur(20px) } }
`;

export function PresentationMode({
  slides: slideData,
  onClose,
  startSlide = 0,
  slideDimensions,
}: PresentationModeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(
    startSlide < slideData.length ? startSlide : 0,
  );
  const [scale, setScale] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const [exitingSlide, setExitingSlide] = useState<number | null>(null);
  const [transitionClass, setTransitionClass] = useState<{ enter: string; exit: string } | null>(null);

  const dims = slideDimensions || { width: 12192000, height: 6858000 };
  const refHeight = (dims.height / dims.width) * REFERENCE_WIDTH;

  // Compute scale to fit viewport
  useEffect(() => {
    function updateScale() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scaleX = vw / REFERENCE_WIDTH;
      const scaleY = vh / refHeight;
      setScale(Math.min(scaleX, scaleY));
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [refHeight]);

  // Request fullscreen on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.requestFullscreen?.().catch(() => {});
  }, []);

  // Listen for fullscreen exit
  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement) {
        onClose();
      }
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [onClose]);

  const navigate = useCallback(
    (next: number, direction: "forward" | "backward") => {
      if (transitioning) return;
      if (next < 0 || next >= slideData.length || next === currentSlide) return;

      const targetSlide = slideData[next];
      const transition = targetSlide?.transition;
      const keyframes = transition
        ? getTransitionKeyframes(transition.type, direction)
        : null;

      if (!keyframes) {
        setCurrentSlide(next);
        return;
      }

      const duration = transition?.durationMs ?? 500;
      const easing = transition?.easing ?? "ease-in-out";

      setExitingSlide(currentSlide);
      setTransitionClass(keyframes);
      setTransitioning(true);

      // Set CSS variables for duration/easing
      const el = containerRef.current;
      if (el) {
        el.style.setProperty("--transition-duration", `${duration}ms`);
        el.style.setProperty("--transition-easing", easing);
      }

      // Switch to new slide immediately (it enters with animation)
      setCurrentSlide(next);

      // Clear exiting slide after animation completes
      setTimeout(() => {
        setExitingSlide(null);
        setTransitionClass(null);
        setTransitioning(false);
      }, duration);
    },
    [currentSlide, slideData, transitioning],
  );

  const goNext = useCallback(() => {
    navigate(currentSlide + 1, "forward");
  }, [navigate, currentSlide]);

  const goPrev = useCallback(() => {
    navigate(currentSlide - 1, "backward");
  }, [navigate, currentSlide]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "Escape":
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            onClose();
          }
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, onClose]);

  // After interacting with an iframe (e.g. 3D model-viewer), focus stays
  // inside the iframe and arrow keys stop working. Listen for postMessage
  // from iframes forwarding navigation keys, and reclaim focus on click.
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type !== "slide-nav-key") return;
      switch (e.data.key) {
        case "ArrowRight":
        case " ":
          goNext();
          break;
        case "ArrowLeft":
          goPrev();
          break;
        case "Escape":
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            onClose();
          }
          break;
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [goNext, goPrev, onClose]);

  if (slideData.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden"
      style={{ cursor: "none" }}
      onMouseMove={(e) => {
        const el = e.currentTarget as HTMLElement & {
          _cursorTimeout?: ReturnType<typeof setTimeout>;
        };
        el.style.cursor = "default";
        clearTimeout(el._cursorTimeout);
        el._cursorTimeout = setTimeout(() => {
          el.style.cursor = "none";
        }, 2000);
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: TRANSITION_KEYFRAMES }} />

      {/* Slide container — rendered at fixed reference width, CSS-scaled to fill viewport */}
      <div
        className="origin-center relative"
        style={{
          width: REFERENCE_WIDTH,
          height: refHeight,
          transform: `scale(${scale})`,
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          if (clickX < rect.width / 3) {
            goPrev();
          } else {
            goNext();
          }
        }}
      >
        {/* Pre-render adjacent slides (hidden) so iframes are loaded before transition */}
        {slideData.map((s, i) => {
          const isCurrent = i === currentSlide;
          const isExiting = i === exitingSlide;
          const isAdjacent = Math.abs(i - currentSlide) <= 1;

          // Only render current, exiting, and adjacent slides
          if (!isCurrent && !isExiting && !isAdjacent) return null;

          let className = "absolute inset-0";
          if (isExiting && transitionClass) {
            className += ` ${transitionClass.exit}`;
          } else if (isCurrent && transitionClass) {
            className += ` ${transitionClass.enter}`;
          } else if (!isCurrent) {
            // Adjacent pre-rendered slides: hidden but mounted
            className += " invisible";
          }

          return (
            <div key={s.uid || `slide-${i}`} className={className} style={{ zIndex: isExiting ? 1 : isCurrent ? 2 : 0 }}>
              <PresentationSlide
                slide={s}
                dims={dims}
              />
            </div>
          );
        })}
      </div>

      {/* Slide counter */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-1.5 rounded-full backdrop-blur-sm select-none pointer-events-none">
        {currentSlide + 1} / {slideData.length}
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={() => {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            onClose();
          }
        }}
        className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl p-2 transition-colors z-10"
        title="Exit (Esc)"
      >
        &times;
      </button>
    </div>
  );
}
