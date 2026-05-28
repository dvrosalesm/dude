/**
 * Dude design system — semantic tokens for AI-generated UI.
 * Values map to CSS custom properties on :root / [data-dude-theme="bone"].
 */

export type DesignTokenCategory =
  | "surface"
  | "text"
  | "brand"
  | "semantic"
  | "shadcn";

export interface ColorToken {
  id: string;
  name: string;
  variable: string;
  category: DesignTokenCategory;
  description: string;
  /** Example hex for docs. */
  sample: string;
}

export interface TypographyToken {
  id: string;
  name: string;
  className: string;
  sample: string;
  usage: string;
}

export interface SpacingToken {
  id: string;
  name: string;
  className: string;
  pixels: number;
}

export interface RadiusToken {
  id: string;
  name: string;
  className: string;
  cssVar?: string;
}

export interface MotionToken {
  id: string;
  name: string;
  duration: string;
  usage: string;
}

export const DESIGN_BANS = [
  {
    id: "no-cards",
    rule: "No cards",
    detail: "Never wrap content in bordered boxes. Separate with spacing and background tints only.",
  },
  {
    id: "no-dividers",
    rule: "No dividers",
    detail: "No horizontal or vertical rules between sections, rows, or panels. Use whitespace.",
  },
  {
    id: "no-pretitles",
    rule: "No pre-titles",
    detail: "No eyebrow labels, uppercase kicker text, or subtitles stacked above a section title.",
  },
] as const;

export const DESIGN_PRINCIPLES = [
  {
    title: "Clarity over cleverness",
    body: "Every element has an obvious purpose. Labels, hierarchy, and CTAs stay predictable.",
  },
  {
    title: "Cool bone white",
    body: "Faint blue-white canvas with soft sky tints for hover and ambient glow.",
  },
  {
    title: "Flat layout",
    body: "No cards, dividers, or pre-titles — hierarchy comes from type size and spacing alone.",
  },
  {
    title: "Soft geometry",
    body: "Rounded type and generous radii keep enterprise UI approachable, not clinical.",
  },
] as const;

export const COLOR_TOKENS: ColorToken[] = [
  {
    id: "bg",
    name: "Bone canvas",
    variable: "--dude-bg",
    category: "surface",
    description: "App canvas and full-height shells.",
    sample: "#FAFCFE",
  },
  {
    id: "surface",
    name: "Paper surface",
    variable: "--dude-surface",
    category: "surface",
    description: "Cards, inputs on focus, elevated panels.",
    sample: "#FFFFFF",
  },
  {
    id: "surface-2",
    name: "Soft blue elevated",
    variable: "--dude-surface-2",
    category: "surface",
    description: "Sidebar selection, chips, secondary panels.",
    sample: "#F2F6FA",
  },
  {
    id: "line",
    name: "Cool border",
    variable: "--dude-line",
    category: "surface",
    description: "Dividers, input borders, subtle outlines.",
    sample: "#E2EAF2",
  },
  {
    id: "text",
    name: "Ink",
    variable: "--dude-text",
    category: "text",
    description: "Headings, body copy, primary labels.",
    sample: "#1A1A1A",
  },
  {
    id: "muted",
    name: "Muted gray",
    variable: "--dude-muted",
    category: "text",
    description: "Hints, metadata, secondary labels.",
    sample: "#737373",
  },
  {
    id: "accent",
    name: "Soft blue accent",
    variable: "--dude-accent",
    category: "brand",
    description: "Highlights, icons, active affordances.",
    sample: "#4F7394",
  },
  {
    id: "accent-soft",
    name: "Accent tint",
    variable: "--dude-accent-soft",
    category: "brand",
    description: "Tinted backgrounds for accent states.",
    sample: "rgb(79 115 148 / 0.08)",
  },
  {
    id: "success",
    name: "Success",
    variable: "--dude-success",
    category: "semantic",
    description: "Ready states, confirmations.",
    sample: "#3D8B63",
  },
  {
    id: "danger",
    name: "Danger",
    variable: "--dude-danger",
    category: "semantic",
    description: "Errors, destructive actions.",
    sample: "#C45C4D",
  },
  {
    id: "text-soft",
    name: "Glass tint",
    variable: "--dude-text-soft",
    category: "surface",
    description: "Floating chrome, translucent headers.",
    sample: "rgb(36 36 34 / 0.04)",
  },
];

export const TYPOGRAPHY_TOKENS: TypographyToken[] = [
  {
    id: "display",
    name: "Display",
    className: "text-3xl font-semibold tracking-tight",
    sample: "General Settings",
    usage: "Preferences section titles",
  },
  {
    id: "title",
    name: "Title",
    className: "text-base font-semibold tracking-tight",
    sample: "Dude",
    usage: "Assistant name in chat chrome",
  },
  {
    id: "body",
    name: "Body",
    className: "text-sm leading-relaxed",
    sample: "Message your assistant or pick a specialist.",
    usage: "Default UI copy, chat, forms",
  },
  {
    id: "caption",
    name: "Caption",
    className: "text-xs text-[var(--dude-muted)]",
    sample: "Focused workspaces for specific work",
    usage: "Hints, sidebar subtitles",
  },
];

export const SPACING_TOKENS: SpacingToken[] = [
  { id: "1", name: "4px", className: "p-1", pixels: 4 },
  { id: "2", name: "8px", className: "p-2", pixels: 8 },
  { id: "3", name: "12px", className: "p-3", pixels: 12 },
  { id: "4", name: "16px", className: "p-4", pixels: 16 },
  { id: "6", name: "24px", className: "p-6", pixels: 24 },
  { id: "8", name: "32px", className: "p-8", pixels: 32 },
];

export const RADIUS_TOKENS: RadiusToken[] = [
  { id: "md", name: "Medium", className: "rounded-lg", cssVar: "--radius" },
  { id: "lg", name: "Large", className: "rounded-xl" },
  { id: "xl", name: "XL", className: "rounded-2xl" },
  { id: "2xl", name: "2XL", className: "rounded-3xl" },
  { id: "full", name: "Pill", className: "rounded-full" },
];

export const MOTION_TOKENS: MotionToken[] = [
  { id: "micro", name: "Micro", duration: "100–150ms", usage: "Hover, focus rings" },
  { id: "state", name: "State", duration: "200–300ms", usage: "Panels, sidebar open" },
  { id: "layout", name: "Layout", duration: "300–500ms", usage: "Route transitions" },
];

export const FONT_STACKS = {
  sans: '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
} as const;
