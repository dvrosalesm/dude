import React, { useEffect, useMemo, useRef } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  Easing,
  Img,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type SlideMotionType =
  | "static"
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right"
  | "pan-up"
  | "pan-down"
  | "drift-in";

export type SlideTransitionType = "fade" | "wipe-left" | "wipe-right" | "slide-up" | "slide-down" | "none";

export type PresentationSlideAnimation = {
  motion: SlideMotionType;
  transition: SlideTransitionType;
  intensity: number;
  htmlPreset?: "cinematic-photo" | "headline-punch" | "editorial-rise" | "parallax-cover" | "soft-reveal";
};

export type PresentationVideoSlide = {
  kind?: "image" | "html";
  imageDataUrl?: string;
  htmlContent?: string;
  htmlScene?: {
    layout: "cover" | "centered";
    backgroundColor: string;
    accentColor: string;
    mutedColor: string;
    fontCss?: string;
    fontFamily?: string;
    titleFontFamily?: string;
    bodyFontFamily?: string;
    photoSrc?: string;
    photoHeightPercent?: number;
    title?: string;
    body?: string;
    logo?: string;
    url?: string;
    bottomPaddingPercent?: number;
  };
  durationSeconds: number;
  index: number;
  summary?: string;
  animation?: PresentationSlideAnimation;
};

export type PresentationVideoProps = {
  slides: PresentationVideoSlide[];
  _width?: number;
  _height?: number;
  _fps?: number;
  _transitionFrames?: number;
};

const DEFAULT_TRANSITION_FRAMES = 10;

function clampDurationFrames(durationSeconds: number, fps: number) {
  return Math.max(1, Math.round(durationSeconds * fps));
}

function clampIntensity(value: number | undefined) {
  if (!Number.isFinite(value)) return 0.55;
  return Math.max(0.2, Math.min(1, value as number));
}

function HtmlSlideFrame({ htmlContent, index }: { htmlContent: string; index: number }) {
  const handle = useRef<number | null>(null);
  const released = useRef(false);

  if (handle.current === null) {
    handle.current = delayRender(`Loading HTML slide ${index + 1}`);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (released.current) return;
      released.current = true;
      cancelRender(new Error(`Timed out loading HTML slide ${index + 1}`));
    }, 15000);

    return () => {
      window.clearTimeout(timer);
      if (!released.current) {
        released.current = true;
        continueRender(handle.current!);
      }
    };
  }, [index]);

  return (
    <iframe
      srcDoc={htmlContent}
      sandbox="allow-same-origin"
      style={{
        width: "100%",
        height: "100%",
        border: "0",
        background: "transparent",
        pointerEvents: "none",
      }}
      onLoad={() => {
        if (released.current) return;
        released.current = true;
        continueRender(handle.current!);
      }}
      title={`Slide ${index + 1}`}
    />
  );
}

function HtmlSceneFonts({
  fontCss,
  index,
}: {
  fontCss?: string;
  index: number;
}) {
  const handle = useRef<number | null>(null);
  const released = useRef(false);

  if (fontCss && handle.current === null) {
    handle.current = delayRender(`Loading HTML slide fonts ${index + 1}`);
  }

  useEffect(() => {
    if (!fontCss) return;

    const style = document.createElement("style");
    style.setAttribute("data-dude-slide-fonts", String(index));
    style.textContent = fontCss;
    document.head.appendChild(style);

    const timeout = window.setTimeout(() => {
      if (!released.current && handle.current !== null) {
        released.current = true;
        continueRender(handle.current);
      }
    }, 5000);

    Promise.resolve(document.fonts?.ready)
      .catch(() => undefined)
      .finally(() => {
        if (!released.current && handle.current !== null) {
          released.current = true;
          window.clearTimeout(timeout);
          continueRender(handle.current);
        }
      });

    return () => {
      window.clearTimeout(timeout);
      style.remove();
      if (!released.current && handle.current !== null) {
        released.current = true;
        continueRender(handle.current);
      }
    };
  }, [fontCss, index]);

  return null;
}

function clampPercent(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, value as number));
}

function splitLines(text: string | undefined) {
  return (text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function HtmlSceneSlide({
  slide,
  durationFrames,
  intensity,
}: {
  slide: PresentationVideoSlide;
  durationFrames: number;
  intensity: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = slide.htmlScene;

  if (!scene) {
    return <HtmlSlideFrame htmlContent={slide.htmlContent || ""} index={slide.index} />;
  }

  const photoProgress = interpolate(frame, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const titleOpacity = interpolate(frame, [0.12 * fps, 0.72 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const titleY = interpolate(frame, [0.12 * fps, 0.72 * fps], [26, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const bodyOpacity = interpolate(frame, [0.28 * fps, 0.95 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const bodyY = interpolate(frame, [0.28 * fps, 0.95 * fps], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const photoScale = interpolate(photoProgress, [0, 1], [1.03 + intensity * 0.02, 1.1 + intensity * 0.03], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const photoX = interpolate(photoProgress, [0, 1], [-(2 + intensity * 1.5), 2 + intensity * 1.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const photoY = interpolate(photoProgress, [0, 1], [-(1 + intensity), 1 + intensity], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoOpacity = interpolate(frame, [0.05 * fps, 0.55 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const ctaOpacity = interpolate(frame, [0.45 * fps, 1.15 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const isCentered = scene.layout === "centered";
  const titleLines = splitLines(scene.title);
  const bodyLines = splitLines(scene.body);

  return (
    <AbsoluteFill style={{ backgroundColor: scene.backgroundColor, color: scene.accentColor }}>
      <HtmlSceneFonts fontCss={scene.fontCss} index={slide.index} />
      {scene.photoSrc ? (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: `${clampPercent(scene.photoHeightPercent, 60)}%`,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <Img
            src={scene.photoSrc}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `translate(${photoX}%, ${photoY}%) scale(${photoScale})`,
              transformOrigin: "center center",
            }}
          />
        </div>
      ) : null}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          fontFamily: scene.fontFamily || "system-ui, -apple-system, sans-serif",
          justifyContent: isCentered ? "center" : "flex-start",
          alignItems: isCentered ? "center" : "stretch",
          textAlign: isCentered ? "center" : "left",
          paddingLeft: isCentered ? "8%" : "6%",
          paddingRight: isCentered ? "8%" : "6%",
          paddingTop: scene.photoSrc ? "4%" : "0%",
          paddingBottom: `${clampPercent(scene.bottomPaddingPercent, 15)}%`,
          gap: isCentered ? "2.6%" : "1.8%",
        }}
      >
        {scene.logo ? (
          <div
            style={{
              fontSize: isCentered ? "64px" : "44px",
              lineHeight: 1,
              opacity: logoOpacity,
              transform: `translateY(${interpolate(frame, [0.05 * fps, 0.55 * fps], [18, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px)`,
            }}
          >
            {scene.logo}
          </div>
        ) : null}

        {titleLines.length ? (
          <div
            style={{
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
              fontFamily: scene.titleFontFamily || scene.fontFamily || "inherit",
              fontSize: isCentered ? "clamp(36px, 7vmin, 64px)" : "clamp(38px, 8vmin, 72px)",
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
            }}
          >
            {titleLines.map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
        ) : null}

        {bodyLines.length ? (
          <div
            style={{
              opacity: bodyOpacity,
              transform: `translateY(${bodyY}px)`,
              fontFamily: scene.bodyFontFamily || scene.fontFamily || "inherit",
              color: scene.mutedColor,
              fontSize: isCentered ? "clamp(22px, 4vmin, 38px)" : "clamp(18px, 3vmin, 30px)",
              lineHeight: 1.35,
            }}
          >
            {bodyLines.map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
        ) : null}

        {scene.url ? (
          <div
            style={{
              opacity: ctaOpacity,
              transform: `translateY(${interpolate(frame, [0.45 * fps, 1.15 * fps], [18, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px)`,
              alignSelf: isCentered ? "center" : "flex-start",
              fontFamily: scene.bodyFontFamily || scene.fontFamily || "inherit",
              padding: "2vh 4vw",
              borderRadius: "1vmin",
              border: `2px solid ${scene.accentColor}`,
              color: scene.accentColor,
              fontSize: "clamp(20px, 3.5vmin, 32px)",
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            {scene.url}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}

function getEffectiveTransitionFrames(
  slides: PresentationVideoSlide[],
  fps: number,
  requested = DEFAULT_TRANSITION_FRAMES,
) {
  if (slides.length <= 1) return 0;
  const minFrames = Math.min(...slides.map((slide) => clampDurationFrames(slide.durationSeconds, fps)));
  return Math.max(0, Math.min(requested, Math.floor((minFrames - 1) / 2)));
}

export function calculatePresentationDurationInFrames({
  slides,
  fps,
  transitionFrames = DEFAULT_TRANSITION_FRAMES,
}: {
  slides: PresentationVideoSlide[];
  fps: number;
  transitionFrames?: number;
}) {
  if (slides.length === 0) {
    return fps * 5;
  }

  const effectiveTransition = getEffectiveTransitionFrames(slides, fps, transitionFrames);
  let cursor = 0;
  slides.forEach((slide, index) => {
    const durationFrames = clampDurationFrames(slide.durationSeconds, fps);
    const startFrame = index === 0 ? 0 : cursor - effectiveTransition;
    cursor = startFrame + durationFrames;
  });
  return cursor;
}

function SlideLayer({
  slide,
  durationFrames,
  transitionFrames,
  index,
  totalSlides,
}: {
  slide: PresentationVideoSlide;
  durationFrames: number;
  transitionFrames: number;
  index: number;
  totalSlides: number;
}) {
  const frame = useCurrentFrame();
  const animation = slide.animation ?? { motion: "zoom-in", transition: "fade", intensity: 0.55 };
  const isHtmlSlide = slide.kind === "html" && !!slide.htmlContent;
  const transition = isHtmlSlide && animation.transition !== "none" ? "fade" : animation.transition;
  const intensity = clampIntensity(animation.intensity);
  const normalizedProgress = interpolate(frame, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const enterProgress = transitionFrames > 0
    ? interpolate(frame, [0, transitionFrames], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  const exitProgress = transitionFrames > 0
    ? interpolate(frame, [Math.max(0, durationFrames - transitionFrames), durationFrames], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const enterOpacity = index === 0
    ? 1
    : transition === "fade"
      ? enterProgress
      : 1;
  const exitOpacity = index === totalSlides - 1
    ? 1
    : transition === "fade"
      ? interpolate(exitProgress, [0, 1], [1, 0])
      : 1;
  const opacity = Math.min(enterOpacity, exitOpacity);
  let startScale = 1.06;
  let endScale = 1.1;
  let startX = 0;
  let endX = 0;
  let startY = 0;
  let endY = 0;

  switch (animation.motion) {
    case "zoom-out":
      startScale = 1.11 + intensity * 0.03;
      endScale = 1.02;
      break;
    case "pan-left":
      startScale = 1.1 + intensity * 0.04;
      endScale = startScale;
      startX = 6 + intensity * 4;
      endX = -6 - intensity * 4;
      break;
    case "pan-right":
      startScale = 1.1 + intensity * 0.04;
      endScale = startScale;
      startX = -6 - intensity * 4;
      endX = 6 + intensity * 4;
      break;
    case "pan-up":
      startScale = 1.1 + intensity * 0.04;
      endScale = startScale;
      startY = 6 + intensity * 4;
      endY = -6 - intensity * 4;
      break;
    case "pan-down":
      startScale = 1.1 + intensity * 0.04;
      endScale = startScale;
      startY = -6 - intensity * 4;
      endY = 6 + intensity * 4;
      break;
    case "drift-in":
      startScale = 1.12 + intensity * 0.03;
      endScale = 1.04;
      startX = -4 - intensity * 3;
      endX = 4 + intensity * 3;
      startY = 3 + intensity * 2;
      endY = -3 - intensity * 2;
      break;
    case "static":
      startScale = 1;
      endScale = 1;
      break;
    case "zoom-in":
    default:
      startScale = 1.03;
      endScale = 1.1 + intensity * 0.03;
      break;
  }

  const scale = interpolate(normalizedProgress, [0, 1], [startScale, endScale]);
  const translateX = interpolate(normalizedProgress, [0, 1], [startX, endX]);
  const translateY = interpolate(normalizedProgress, [0, 1], [startY, endY]);

  const transitionTransform = (() => {
    if (index === 0 || transitionFrames <= 0) return "";
    switch (transition) {
      case "slide-up":
        return ` translateY(${interpolate(enterProgress, [0, 1], [12, 0])}%)`;
      case "slide-down":
        return ` translateY(${interpolate(enterProgress, [0, 1], [-12, 0])}%)`;
      case "wipe-left":
        return ` translateX(${interpolate(enterProgress, [0, 1], [10, 0])}%)`;
      case "wipe-right":
        return ` translateX(${interpolate(enterProgress, [0, 1], [-10, 0])}%)`;
      default:
        return "";
    }
  })();

  const clipPath = (() => {
    if (transitionFrames <= 0) return undefined;
    switch (transition) {
      case "wipe-left":
        return `inset(0 ${interpolate(enterProgress, [0, 1], [100, 0])}% 0 0)`;
      case "wipe-right":
        return `inset(0 0 0 ${interpolate(enterProgress, [0, 1], [100, 0])}%)`;
      default:
        return undefined;
    }
  })();

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: isHtmlSlide
          ? (transitionTransform.trim() || undefined)
          : `translate(${translateX}%, ${translateY}%) scale(${scale})${transitionTransform}`,
        transformOrigin: "center center",
        clipPath,
      }}
    >
      {isHtmlSlide ? (
        <HtmlSceneSlide slide={slide} durationFrames={durationFrames} intensity={intensity} />
      ) : (
        <Img
          src={slide.imageDataUrl || ""}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
    </AbsoluteFill>
  );
}

export function PresentationVideo({
  slides,
  _transitionFrames = DEFAULT_TRANSITION_FRAMES,
}: PresentationVideoProps) {
  const { fps } = useVideoConfig();

  const timeline = useMemo(() => {
    const transitionFrames = getEffectiveTransitionFrames(slides, fps, _transitionFrames);
    let cursor = 0;
    return slides.map((slide, index) => {
      const durationFrames = clampDurationFrames(slide.durationSeconds, fps);
      const startFrame = index === 0 ? 0 : cursor - transitionFrames;
      cursor = startFrame + durationFrames;
      return { slide, startFrame, durationFrames, transitionFrames };
    });
  }, [slides, fps, _transitionFrames]);

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {timeline.map(({ slide, startFrame, durationFrames, transitionFrames }, index) => (
        <Sequence key={`${slide.index}-${startFrame}`} from={startFrame} durationInFrames={durationFrames}>
          <SlideLayer
            slide={slide}
            durationFrames={durationFrames}
            transitionFrames={transitionFrames}
            index={index}
            totalSlides={timeline.length}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
