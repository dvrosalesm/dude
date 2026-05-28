"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@dude/ui/design-system";
import {
  clearTransform,
  paintChatDreamEffect,
  paintChatDreamEffectFromImage,
} from "../../lib/html-in-canvas/effects";
import {
  asDrawContext,
  asPaintCanvas,
  isElectronDesktop,
  supportsHtmlInCanvas,
} from "../../lib/html-in-canvas/support";
import type { ChatCanvasEffect, DreamPhase } from "../../lib/html-in-canvas/types";

type HtmlInCanvasShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  effect?: ChatCanvasEffect;
  phase?: DreamPhase;
  style?: CSSProperties;
};

type RenderMode = "native" | "desktop-compositor" | "fallback";

function resolveRenderMode(): RenderMode {
  if (supportsHtmlInCanvas()) return "native";
  if (isElectronDesktop()) return "desktop-compositor";
  return "fallback";
}

function syncCanvasPixels(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = window.devicePixelRatio || 1;
  const nextWidth = Math.max(1, Math.round(width * dpr));
  const nextHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
}

function NativeHtmlInCanvasShell({
  children,
  className,
  contentClassName,
  effect,
  phase = "idle",
  style,
}: HtmlInCanvasShellProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(performance.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    const content = contentRef.current;
    if (!canvas || !content) return;

    const paintCanvas = asPaintCanvas(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const drawCtx = asDrawContext(ctx);

    const paint = () => {
      paintChatDreamEffect(drawCtx, canvas, content, {
        phase,
        time: timeRef.current,
        effect: effect ?? "dream",
        revealProgress: 0,
      });
    };

    paintCanvas.onpaint = paint;

    const syncLayout = () => {
      const rect = content.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      canvas.style.height = `${Math.ceil(rect.height)}px`;
      syncCanvasPixels(canvas, rect.width, rect.height);
      paintCanvas.requestPaint();
    };

    syncLayout();

    const contentObserver = new ResizeObserver(syncLayout);
    contentObserver.observe(content);

    return () => {
      paintCanvas.onpaint = null;
      contentObserver.disconnect();
      clearTransform(content);
    };
  }, [effect, phase]);

  useEffect(() => {
    if (phase !== "thinking") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const paintCanvas = asPaintCanvas(canvas);

    let raf: number;
    const loop = (now: number) => {
      timeRef.current = now;
      paintCanvas.requestPaint();
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);

    return () => window.cancelAnimationFrame(raf);
  }, [phase]);

  return (
    <canvas
      ref={canvasRef}
      // @ts-expect-error Experimental HTML-in-Canvas attribute (Chromium)
      layoutsubtree=""
      className={cn(
        "html-in-canvas-shell block w-full max-w-full border-0 bg-transparent p-0",
        className,
      )}
      style={{ background: "transparent", ...style }}
      data-html-in-canvas="native"
      data-dream-phase={phase}
    >
      <div ref={contentRef} className={cn("w-full bg-transparent", contentClassName)}>
        {children}
      </div>
    </canvas>
  );
}

function DesktopCanvasCompositor({
  children,
  className,
  contentClassName,
  phase = "idle",
  style,
}: HtmlInCanvasShellProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const snapshotRef = useRef<HTMLCanvasElement | null>(null);
  const captureTimerRef = useRef<number | null>(null);
  const capturingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const timeRef = useRef(performance.now());
  const [compositorLive, setCompositorLive] = useState(false);

  const repaintSnapshot = useCallback(() => {
    const display = displayRef.current;
    const snapshot = snapshotRef.current;
    if (!display || !snapshot) return;

    const ctx = display.getContext("2d");
    if (!ctx) return;

    paintChatDreamEffectFromImage(ctx, display, snapshot, {
      phase,
      time: timeRef.current,
      effect: "dream",
      revealProgress: 0,
    });
  }, [phase]);

  const captureContent = useCallback(async () => {
    const content = contentRef.current;
    const display = displayRef.current;
    if (!content || !display || capturingRef.current) return;

    const rect = content.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    capturingRef.current = true;
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const snapshot = await html2canvas(content, {
        scale: window.devicePixelRatio || 1,
        width: rect.width,
        height: rect.height,
        backgroundColor: null,
        logging: false,
        useCORS: true,
      });

      snapshotRef.current = snapshot;
      display.style.width = `${Math.ceil(rect.width)}px`;
      display.style.height = `${Math.ceil(rect.height)}px`;
      syncCanvasPixels(display, rect.width, rect.height);
      repaintSnapshot();
      setCompositorLive(true);
    } catch (error) {
      console.error("[HTML-IN-CANVAS] desktop capture failed:", error);
      setCompositorLive(false);
    } finally {
      capturingRef.current = false;
    }
  }, [repaintSnapshot]);

  const scheduleCapture = useCallback(() => {
    if (captureTimerRef.current != null) {
      window.clearTimeout(captureTimerRef.current);
    }
    captureTimerRef.current = window.setTimeout(() => {
      void captureContent();
    }, 200);
  }, [captureContent]);

  useEffect(() => {
    scheduleCapture();

    const content = contentRef.current;
    if (!content) return;

    const resizeObserver = new ResizeObserver(scheduleCapture);
    resizeObserver.observe(content);

    const mutationObserver = new MutationObserver(scheduleCapture);
    mutationObserver.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (captureTimerRef.current != null) {
        window.clearTimeout(captureTimerRef.current);
      }
    };
  }, [scheduleCapture]);

  useEffect(() => {
    if (phase !== "thinking" || !compositorLive) return;

    const tick = (now: number) => {
      timeRef.current = now;
      repaintSnapshot();
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [compositorLive, phase, repaintSnapshot]);

  return (
    <div
      className={cn("html-in-canvas-desktop relative min-h-0 w-full", className)}
      style={style}
      data-html-in-canvas="desktop-compositor"
      data-dream-phase={phase}
    >
      <div
        ref={contentRef}
        className={cn(
          "relative z-[1] w-full",
          compositorLive && "opacity-0",
          contentClassName,
        )}
      >
        {children}
      </div>
      <canvas
        ref={displayRef}
        className={cn(
          "pointer-events-none absolute inset-0 z-[2] max-w-full",
          !compositorLive && "opacity-0",
        )}
        aria-hidden
      />
    </div>
  );
}

function CssFallbackShell({
  children,
  className,
  contentClassName,
  phase = "idle",
  style,
}: HtmlInCanvasShellProps) {
  return (
    <div
      className={cn(
        "html-in-canvas-fallback relative min-h-0 w-full",
        phase === "thinking" && "html-in-canvas-fallback--thinking",
        className,
      )}
      style={style}
      data-html-in-canvas="fallback"
      data-dream-phase={phase}
    >
      <div
        aria-hidden
        className="html-in-canvas-fallback__glow pointer-events-none absolute inset-0"
      />
      <div className={cn("relative z-[1] w-full", contentClassName)}>{children}</div>
    </div>
  );
}

/** Canvas compositing only while `phase === "thinking"`. Otherwise passthrough. */
export function HtmlInCanvasShell({
  children,
  phase = "idle",
  className,
  contentClassName,
  effect,
  style,
}: HtmlInCanvasShellProps) {
  const [mode] = useState<RenderMode>(() => resolveRenderMode());

  if (phase !== "thinking") {
    return (
      <div className={cn("w-full", className, contentClassName)} style={style}>
        {children}
      </div>
    );
  }

  const props = { children, className, contentClassName, effect, phase, style };

  if (mode === "native") {
    return <NativeHtmlInCanvasShell {...props} />;
  }
  if (mode === "desktop-compositor") {
    return <DesktopCanvasCompositor {...props} />;
  }
  return <CssFallbackShell {...props} />;
}

export function useHtmlInCanvasSupported(): boolean {
  const [supported] = useState(() => supportsHtmlInCanvas());
  return supported;
}

export function useHtmlInCanvasMode(): RenderMode {
  const [mode] = useState<RenderMode>(() => resolveRenderMode());
  return mode;
}
