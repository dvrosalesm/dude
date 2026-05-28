/** App icon face geometry — sampled from `public/assets/icon.png` (viewBox 0 0 100 100). */
export const DUDE_FACE_VIEWBOX = 100;

export const DUDE_FACE_MOUTH = "M 32.6 60.4 Q 46.9 68.4 67 60.7";

/** Happy / idle — upward arc (closed eye), local coords centered on eye. */
export const DUDE_FACE_EYE_CLOSED_LOCAL = "M -8 2.2 Q 0 -3.2 8 2.2";

/** Closed-eye stroke — thinner than open circles so arcs stay legible when scaled. */
export const DUDE_FACE_CLOSED_EYE_STROKE_WIDTH = 3.8;

export const DUDE_FACE_EYE_CENTERS = {
  left: { x: 31.35, y: 32.2 },
  right: { x: 68.65, y: 32.2 },
} as const;

export const DUDE_FACE_OPEN_EYE_RADIUS = 5.2;

export const DUDE_FACE_STROKE_WIDTH = 5.2;

export const DUDE_FACE_COLORS = {
  eye: "#5A9BF5",
  mouth: "#6A84A5",
} as const;

/** Scale 100-unit icon paths to fit the 40×40 agent blob canvas. */
export const DUDE_FACE_BLOB_TRANSFORM =
  "translate(20 20) scale(0.32) translate(-50 -49.9)";

export type DudeFaceMode = "idle" | "listening" | "thinking";
