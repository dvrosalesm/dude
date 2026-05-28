import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { cn } from "../lib/utils.js";
import { AgentBlobFace } from "./agent-blob-face.js";
import { DUDE_FACE_COLORS } from "./dude-face-paths.js";
import "../styles/agent-blob.css";

export type AgentBlobState = "idle" | "thinking" | "listening";

export function deriveAgentBlobState(input: {
  sending?: boolean;
  hasDraft?: boolean;
}): AgentBlobState {
  if (input.sending) return "thinking";
  if (input.hasDraft) return "listening";
  return "idle";
}

const MOTION_PACE = 0.38;

const TIMING: Record<
  AgentBlobState,
  { flowMs: number; driftPeriod: number; floatPeriod: number; chaos: number }
> = {
  idle: { flowMs: 6200, driftPeriod: 13, floatPeriod: 11, chaos: 1.35 },
  listening: { flowMs: 3600, driftPeriod: 7, floatPeriod: 6, chaos: 1.65 },
  thinking: { flowMs: 1800, driftPeriod: 3, floatPeriod: 2.6, chaos: 2.15 },
};

const STATE_PALETTE: Record<
  AgentBlobState,
  { a: string; b: string; c: string; d: string; e: string }
> = {
  idle: { a: "#8BB8DC", b: "#6BA3C9", c: "#94B8E8", d: "#A8CCE8", e: "#7B9FD4" },
  listening: { a: "#6BC5A0", b: "#5BA3C9", c: "#7B9FD4", d: "#8AD4BE", e: "#94B8E8" },
  thinking: { a: "#7B9FD4", b: "#6BA3C9", c: "#94B8E8", d: "#8BB8DC", e: "#5BA3C9" },
};

type StrandKind = "main" | "ghost" | "whisp" | "fuzzA" | "fuzzB";

type StrandStyle = {
  kind: StrandKind;
  points: number;
  chaosMul: number;
  spread: number;
  stroke: keyof (typeof STATE_PALETTE)["idle"];
  width: number;
  opacity: number;
  dash: string;
  glow: boolean;
  timeScale: number;
  timeOffset: number;
};

const STRANDS: StrandStyle[] = [
  {
    kind: "main",
    points: 11,
    chaosMul: 1,
    spread: 1,
    stroke: "a",
    width: 2.7,
    opacity: 1,
    dash: "10 8",
    glow: true,
    timeScale: 1,
    timeOffset: 0,
  },
  {
    kind: "ghost",
    points: 10,
    chaosMul: 1.12,
    spread: 1.08,
    stroke: "c",
    width: 1.3,
    opacity: 0.42,
    dash: "6 12",
    glow: false,
    timeScale: 0.88,
    timeOffset: 0.55,
  },
  {
    kind: "whisp",
    points: 8,
    chaosMul: 1.35,
    spread: 0.82,
    stroke: "d",
    width: 0.95,
    opacity: 0.32,
    dash: "4 10",
    glow: false,
    timeScale: 1.22,
    timeOffset: 1.4,
  },
  {
    kind: "fuzzA",
    points: 7,
    chaosMul: 1.55,
    spread: 0.7,
    stroke: "e",
    width: 0.75,
    opacity: 0.26,
    dash: "3 9",
    glow: false,
    timeScale: 1.45,
    timeOffset: 2.2,
  },
  {
    kind: "fuzzB",
    points: 6,
    chaosMul: 1.7,
    spread: 0.62,
    stroke: "b",
    width: 0.65,
    opacity: 0.22,
    dash: "2 11",
    glow: false,
    timeScale: 1.65,
    timeOffset: 3.1,
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function seedFromId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return hash;
}

function hash1D(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function smoothNoise(t: number) {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  return hash1D(i) * (1 - u) + hash1D(i + 1) * u;
}

function fractalNoise(t: number, octaves: number) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o += 1) {
    sum += smoothNoise(t * freq) * amp;
    norm += amp;
    amp *= 0.52;
    freq *= 2.07;
  }
  return sum / norm;
}

function wave(t: number, seed: number, freq: number, amp: number) {
  return (
    Math.sin(t * freq + seed) * amp +
    Math.sin(t * freq * 1.73 + seed * 1.9) * amp * 0.55 +
    Math.cos(t * freq * 0.61 + seed * 0.7) * amp * 0.35 +
    Math.sin(t * freq * 2.41 + seed * 0.3) * amp * 0.22
  );
}

function catmullRomPath(points: Point[]) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const tension = 7.5 + fractalNoise(i * 0.7 + points.length) * 1.5;
    const cp1x = p1.x + (p2.x - p0.x) / tension;
    const cp1y = p1.y + (p2.y - p0.y) / tension;
    const cp2x = p2.x - (p3.x - p1.x) / tension;
    const cp2y = p2.y - (p3.y - p1.y) / tension;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function softClamp(value: number, min: number, max: number, edge = 3) {
  if (value < min + edge) {
    const t = (value - min) / edge;
    return min + edge * t * t * (3 - 2 * t);
  }
  if (value > max - edge) {
    const t = (max - value) / edge;
    return max - edge * t * t * (3 - 2 * t);
  }
  return value;
}

function lerpPoints(prev: Point[], next: Point[], alpha: number): Point[] {
  return next.map((point, index) => {
    const from = prev[index] ?? point;
    return {
      x: from.x + (point.x - from.x) * alpha,
      y: from.y + (point.y - from.y) * alpha,
    };
  });
}

function buildStrandPoints(
  tSec: number,
  seed: number,
  chaos: number,
  strand: StrandStyle,
): Point[] {
  const strandSeed = seed + strand.kind.length * 19 + strand.points * 3;
  const points: Point[] = [];

  const centerX =
    20 +
    (fractalNoise(tSec * 0.41 + strandSeed * 0.01, 3) - 0.5) * 9 * chaos;
  const centerY =
    20 +
    (fractalNoise(tSec * 0.37 + strandSeed * 0.02 + 4, 3) - 0.5) * 9 * chaos;

  for (let i = 0; i < strand.points; i += 1) {
    const u = i / (strand.points - 1);
    const n1 = fractalNoise(tSec * 1.8 * strand.timeScale + u * 6 + strandSeed, 4);
    const n2 = fractalNoise(tSec * 2.1 * strand.timeScale + i * 1.7 + strandSeed * 2, 4);
    const n3 = fractalNoise(tSec * 3.3 + u * 11 + i * 0.5 + strandSeed * 0.3, 3);

    const angle =
      -Math.PI * 0.75 +
      u * Math.PI * 1.55 +
      (n1 - 0.5) * 1.8 * chaos * strand.chaosMul +
      wave(tSec * 0.55 + strand.timeOffset, strandSeed, 1.1, 0.45);

    const rx =
      (6 + n2 * 10 + u * 4 + wave(tSec * 0.6, strandSeed + i, 1.4, 3.2)) *
      strand.spread;
    const ry =
      (6 + n3 * 9 + u * 5 + wave(tSec * 0.52, strandSeed + i * 2, 1.2, 2.8)) *
      strand.spread;

    const kink =
      (fractalNoise(tSec * 0.55 + i * 0.31 + strandSeed, 2) - 0.5) *
      2.8 *
      chaos *
      strand.chaosMul;

    const jitterX =
      (wave(tSec * chaos * 1.4 + u * 5, strandSeed + i * 2, 3.1 + i * 0.2, 5.2) +
        (n1 - 0.5) * 6 +
        kink) *
      chaos *
      strand.chaosMul;
    const jitterY =
      (wave(tSec * chaos * 1.2 + i * 1.9, strandSeed + i * 5, 2.7 + i * 0.25, 4.8) +
        (n2 - 0.5) * 6 +
        kink * 0.8) *
      chaos *
      strand.chaosMul;

    points.push({
      x: softClamp(centerX + Math.cos(angle) * rx + jitterX, 4, 36),
      y: softClamp(centerY + Math.sin(angle) * ry + jitterY, 5, 36),
    });
  }

  return points;
}

function buildStrandPathFromPoints(points: Point[]) {
  return catmullRomPath(points);
}

function buildStrandPath(
  tSec: number,
  seed: number,
  chaos: number,
  strand: StrandStyle,
) {
  return buildStrandPathFromPoints(
    buildStrandPoints(tSec * strand.timeScale + strand.timeOffset, seed, chaos, strand),
  );
}

function useAgentBlobMotion(
  state: AgentBlobState,
  seed: number,
  motionScale: number,
  refs: {
    svg: React.RefObject<SVGSVGElement | null>;
    inner: React.RefObject<SVGGElement | null>;
    paths: React.RefObject<(SVGPathElement | null)[]>;
    measures: React.RefObject<(SVGPathElement | null)[]>;
  },
) {
  useEffect(() => {
    const timing = TIMING[state];
    const flowMs = timing.flowMs * motionScale;
    const floatPeriod = timing.floatPeriod * motionScale;
    const driftPeriod = timing.driftPeriod * motionScale;
    const start = performance.now();
    let raf = 0;

    const smoothedPoints = STRANDS.map((strand) =>
      buildStrandPoints(strand.timeOffset, seed, timing.chaos, strand),
    );

    const tick = (now: number) => {
      const elapsed = now - start;
      const tSec = (elapsed / 1000) * MOTION_PACE;
      const floatPhase = (tSec / floatPeriod) * Math.PI * 2;
      const driftPhase = (tSec / driftPeriod) * Math.PI * 2;
      const flowOffset = elapsed / flowMs;
      const chaos = timing.chaos * (motionScale > 1 ? 0.8 : 1);
      const smoothAlpha = state === "thinking" ? 0.18 : 0.14;

      STRANDS.forEach((strand, index) => {
        const path = refs.paths.current?.[index];
        const measure = refs.measures.current?.[index];
        if (!path || !measure) return;

        const target = buildStrandPoints(
          tSec * strand.timeScale + strand.timeOffset,
          seed,
          chaos,
          strand,
        );
        smoothedPoints[index] = lerpPoints(smoothedPoints[index], target, smoothAlpha);
        const d = buildStrandPathFromPoints(smoothedPoints[index]);
        path.setAttribute("d", d);
        measure.setAttribute("d", d);

        const dashSpan = 48 + index * 6;
        const dir = index % 2 === 0 ? -1 : 1;
        path.style.strokeDashoffset = `${dir * dashSpan * (flowOffset + index * 0.13)}`;
        path.style.strokeWidth = `${strand.width + Math.sin(tSec * 1.4 + index + seed) * 0.12}`;
      });

      const wobbleX = wave(tSec * 0.65, seed, 1.3, 2.4);
      const floatY = Math.sin(floatPhase) * -2.4 + wave(tSec * 0.5, seed, 2.2, 1.2);
      const driftDeg =
        Math.sin(driftPhase) * 7 +
        wave(tSec * 0.35, seed, 0.85, 2.8) +
        (fractalNoise(tSec * 0.45 + seed, 2) - 0.5) * 6;
      const thinkScale =
        state === "thinking" ? 1 + Math.sin(floatPhase * 2.6) * 0.08 : 1;
      const listenScaleX =
        state === "listening" ? 1 + Math.sin(floatPhase * 1.5) * 0.08 : 1;

      refs.svg.current?.style.setProperty(
        "transform",
        `translate(${wobbleX}px, ${floatY}px) scale(${thinkScale}) scaleX(${listenScaleX})`,
      );
      refs.inner.current?.style.setProperty(
        "transform",
        `rotate(${driftDeg}deg)`,
      );

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, motionScale, seed]);
}

type AgentBlobProps = {
  state?: AgentBlobState;
  size?: number;
  className?: string;
  "aria-label"?: string;
};

export function AgentBlob({
  state = "idle",
  size = 40,
  className,
  "aria-label": ariaLabel = "Agent",
}: AgentBlobProps) {
  const reactId = useId();
  const safeId = reactId.replace(/:/g, "");
  const ribbonGradId = `agent-ribbon-grad-${safeId}`;
  const glowId = `agent-ribbon-glow-${safeId}`;
  const faceGlowId = `agent-face-glow-${safeId}`;
  const palette = STATE_PALETTE[state];
  const seed = seedFromId(reactId);
  const eyeStroke =
    state === "listening" ? palette.d : DUDE_FACE_COLORS.eye;
  const mouthStroke = DUDE_FACE_COLORS.mouth;

  const svgRef = useRef<SVGSVGElement>(null);
  const innerRef = useRef<SVGGElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const measureRefs = useRef<(SVGPathElement | null)[]>([]);

  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const motionScale = reduceMotion ? 2.8 : 1;

  useAgentBlobMotion(state, seed, motionScale, {
    svg: svgRef,
    inner: innerRef,
    paths: pathRefs,
    measures: measureRefs,
  });

  const cssVars = {
    "--ribbon-a": palette.a,
    "--ribbon-b": palette.b,
    "--ribbon-c": palette.c,
    "--ribbon-d": palette.d,
  } as CSSProperties;

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      data-state={state}
      style={cssVars}
      className={cn("agent-blob", `agent-blob--${state}`, className)}
    >
      <defs>
        <linearGradient
          id={ribbonGradId}
          x1="4"
          y1="6"
          x2="36"
          y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={palette.a} />
          <stop offset="32%" stopColor={palette.b} />
          <stop offset="64%" stopColor={palette.c} />
          <stop offset="88%" stopColor={palette.d} />
          <stop offset="100%" stopColor={palette.e} />
        </linearGradient>

        <filter
          id={glowId}
          x="-60%"
          y="-60%"
          width="220%"
          height="220%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="2" result="blur" />
        </filter>

        <filter
          id={faceGlowId}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {STRANDS.map((strand, index) => (
        <path
          key={`m-${strand.kind}`}
          ref={(el) => {
            measureRefs.current[index] = el;
          }}
          d={buildStrandPath(0, seed, TIMING[state].chaos, strand)}
          fill="none"
          stroke="none"
          aria-hidden
        />
      ))}

      <g ref={innerRef} style={{ transformOrigin: "20px 20px" }}>
        {STRANDS.map((strand, index) => (
          <path
            key={strand.kind}
            ref={(el) => {
              pathRefs.current[index] = el;
            }}
            d={buildStrandPath(strand.timeOffset, seed, TIMING[state].chaos, strand)}
            className={`agent-blob__strand agent-blob__strand--${strand.kind}`}
            stroke={index === 0 ? `url(#${ribbonGradId})` : palette[strand.stroke]}
            strokeWidth={strand.width}
            strokeLinecap="round"
            strokeOpacity={strand.opacity}
            strokeDasharray={strand.dash}
            fill="none"
            filter={strand.glow ? `url(#${glowId})` : undefined}
          />
        ))}
      </g>

      <AgentBlobFace
        state={state}
        eyeStroke={eyeStroke}
        mouthStroke={mouthStroke}
        glowFilterId={faceGlowId}
        decorativeMotion={!reduceMotion}
      />
    </svg>
  );
}
