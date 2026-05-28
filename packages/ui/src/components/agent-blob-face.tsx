"use client";

import { useRef } from "react";
import {
  DUDE_FACE_BLOB_TRANSFORM,
  DUDE_FACE_EYE_CENTERS,
  DUDE_FACE_EYE_CLOSED_LOCAL,
  DUDE_FACE_CLOSED_EYE_STROKE_WIDTH,
  DUDE_FACE_MOUTH,
  DUDE_FACE_OPEN_EYE_RADIUS,
  DUDE_FACE_STROKE_WIDTH,
  type DudeFaceMode,
} from "./dude-face-paths.js";
import { useAgentFaceMotion } from "./use-agent-face-motion.js";

type AgentBlobFaceProps = {
  state: DudeFaceMode;
  eyeStroke: string;
  mouthStroke: string;
  glowFilterId: string;
  /** When false (prefers-reduced-motion), state morphs still run; loops are skipped. */
  decorativeMotion?: boolean;
};

function ClosedEye({
  side,
  stroke,
  closedRef,
  glowFilterId,
}: {
  side: "left" | "right";
  stroke: string;
  closedRef: React.RefObject<SVGPathElement | null>;
  glowFilterId: string;
}) {
  const { x, y } = DUDE_FACE_EYE_CENTERS[side];

  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        ref={closedRef}
        d={DUDE_FACE_EYE_CLOSED_LOCAL}
        fill="none"
        stroke={stroke}
        strokeWidth={DUDE_FACE_CLOSED_EYE_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${glowFilterId})`}
        className={`agent-blob__eye-closed agent-blob__eye-closed--${side}`}
      />
    </g>
  );
}

function OpenEye({
  side,
  stroke,
  openRef,
}: {
  side: "left" | "right";
  stroke: string;
  openRef: React.RefObject<SVGGElement | null>;
}) {
  const { x, y } = DUDE_FACE_EYE_CENTERS[side];

  return (
    <g transform={`translate(${x} ${y})`}>
      <g
        ref={openRef}
        className={`agent-blob__eye-open-wrap agent-blob__eye-open-wrap--${side}`}
        display="none"
        opacity={0}
      >
        <circle
          cx={0}
          cy={0}
          r={DUDE_FACE_OPEN_EYE_RADIUS}
          fill="none"
          stroke={stroke}
          strokeWidth={DUDE_FACE_STROKE_WIDTH}
          className={`agent-blob__eye-open agent-blob__eye-open--${side}`}
        />
      </g>
    </g>
  );
}

export function AgentBlobFace({
  state,
  eyeStroke,
  mouthStroke,
  glowFilterId,
  decorativeMotion = true,
}: AgentBlobFaceProps) {
  const leftClosedRef = useRef<SVGPathElement>(null);
  const rightClosedRef = useRef<SVGPathElement>(null);
  const leftOpenRef = useRef<SVGGElement>(null);
  const rightOpenRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);

  useAgentFaceMotion(state, decorativeMotion, {
    leftClosed: leftClosedRef,
    rightClosed: rightClosedRef,
    leftOpen: leftOpenRef,
    rightOpen: rightOpenRef,
    mouth: mouthRef,
  });

  return (
    <g
      className="agent-blob__face"
      transform={DUDE_FACE_BLOB_TRANSFORM}
      data-face-mode={state}
    >
      <g className="agent-blob__face-glow">
        <ClosedEye
          side="left"
          stroke={eyeStroke}
          closedRef={leftClosedRef}
          glowFilterId={glowFilterId}
        />
        <ClosedEye
          side="right"
          stroke={eyeStroke}
          closedRef={rightClosedRef}
          glowFilterId={glowFilterId}
        />
        <path
          ref={mouthRef}
          d={DUDE_FACE_MOUTH}
          fill="none"
          stroke={mouthStroke}
          strokeWidth={DUDE_FACE_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="agent-blob__mouth"
          opacity={0.55}
          filter={`url(#${glowFilterId})`}
        />
      </g>

      {state !== "idle" && (
        <g className="agent-blob__face-open-eyes">
          <OpenEye side="left" stroke={eyeStroke} openRef={leftOpenRef} />
          <OpenEye side="right" stroke={eyeStroke} openRef={rightOpenRef} />
        </g>
      )}
    </g>
  );
}
