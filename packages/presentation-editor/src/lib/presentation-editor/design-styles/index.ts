/**
 * Design style registry.
 *
 * Each style maps to a markdown file in this directory that contains
 * guidelines (colors, typography, composition, mood) the agent will follow
 * when generating slides. The registry itself is client-safe — the markdown
 * is loaded server-side via `loadDesignStyleGuidelines`.
 */

export type DesignStyleFont = "sans" | "serif" | "mono" | "display";
export type DesignStyleDecoration =
  | "none"
  | "grid"
  | "scanlines"
  | "dots"
  | "noise"
  | "columns"
  | "shapes"
  | "chrome"
  | "shadow"
  | "terminal"
  | "bauhaus"
  | "art-deco"
  | "vaporwave"
  | "zine";

export type DesignStyleCategory = "classic" | "editorial" | "tech" | "playful" | "vintage";

export interface DesignStylePreview {
  /** CSS background value — solid color or gradient. */
  bg: string;
  /** Foreground text color. */
  fg: string;
  /** Accent color used for the highlight shape. */
  accent: string;
  /** Font family hint for the preview slide. */
  font: DesignStyleFont;
  /** Optional decoration overlay. */
  decoration?: DesignStyleDecoration;
  /** Whether to show a serif "Aa" glyph in the preview. */
  showAa?: boolean;
}

export interface DesignStyle {
  /** Stable key — matches the .md filename (without extension). */
  key: string;
  /** Display label for the UI. */
  label: string;
  /** Short description shown under the label. */
  description: string;
  /** Categories used by the style picker filter. */
  categories: DesignStyleCategory[];
  /** Visual preview hint for the style picker. */
  preview: DesignStylePreview;
  /** Representative color palette shown in the "Your design system" summary. */
  palette: string[];
}

export const DEFAULT_DESIGN_STYLE = "default";

export const DESIGN_STYLE_CATEGORIES: { key: DesignStyleCategory | "all"; label: string }[] = [
  { key: "all",       label: "All" },
  { key: "classic",   label: "Classic" },
  { key: "editorial", label: "Editorial" },
  { key: "tech",      label: "Tech" },
  { key: "playful",   label: "Playful" },
  { key: "vintage",   label: "Vintage" },
];

export const DESIGN_STYLES: DesignStyle[] = [
  { key: "default",            label: "Default",             description: "Clean, professional",
    categories: ["editorial"],
    preview: { bg: "#f5efe4", fg: "#1a1a1a", accent: "#d4a94a", font: "sans" },
    palette: ["#ffffff", "#f5efe4", "#d4a94a", "#1a1a1a"] },

  { key: "editorial",          label: "Editorial",           description: "Crisp type, pull quotes",
    categories: ["editorial"],
    preview: { bg: "#f5efe4", fg: "#0f0f0f", accent: "#c91e1e", font: "serif" },
    palette: ["#ffffff", "#f5efe4", "#c91e1e", "#0f0f0f"] },

  { key: "minimalist",         label: "Minimalist",          description: "Whitespace, thin rules",
    categories: ["editorial", "classic"],
    preview: { bg: "#f5efe4", fg: "#0a0a0a", accent: "#0a0a0a", font: "sans" },
    palette: ["#ffffff", "#0a0a0a", "#cdcdcd", "#0a0a0a"] },

  { key: "swiss",              label: "Swiss",               description: "Helvetica, grid, red accents",
    categories: ["classic", "editorial"],
    preview: { bg: "#f5efe4", fg: "#000000", accent: "#e4002b", font: "sans", decoration: "grid" },
    palette: ["#ffffff", "#f0f0f0", "#e4002b", "#000000"] },

  { key: "scandinavian",       label: "Scandinavian",        description: "Muted neutrals, breathing",
    categories: ["classic", "editorial"],
    preview: { bg: "#f1ede4", fg: "#2a2a2a", accent: "#8a9a82", font: "sans" },
    palette: ["#f5f1ea", "#e5dfd0", "#8a9a82", "#2a2a2a"] },

  { key: "nordic-noir",        label: "Nordic Noir",         description: "Cold greys, amber accent",
    categories: ["editorial", "classic"],
    preview: { bg: "#eee7d9", fg: "#1a1a1a", accent: "#FBB76B", font: "serif", showAa: true },
    palette: ["#eee7d9", "#c9c0ae", "#FBB76B", "#1a1a1a"] },

  { key: "vintage-newspaper",  label: "Vintage News",        description: "Newsprint, serif headlines",
    categories: ["vintage", "editorial"],
    preview: { bg: "#f1ebdb", fg: "#111111", accent: "#5a2a1a", font: "serif", decoration: "columns", showAa: true },
    palette: ["#f1ebdb", "#d4cdb6", "#5a2a1a", "#111111"] },

  { key: "renaissance",        label: "Renaissance",         description: "Oil tones, flourish",
    categories: ["vintage", "classic"],
    preview: { bg: "#f3e8d4", fg: "#3b1a0e", accent: "#8a3a28", font: "serif", showAa: true },
    palette: ["#f3e8d4", "#e0c9a0", "#8a3a28", "#3b1a0e"] },

  { key: "zine",               label: "Zine",                description: "Photocopy punk, cut-paste",
    categories: ["playful", "vintage"],
    preview: { bg: "#ededea", fg: "#0a0a0a", accent: "#d33030", font: "mono", decoration: "zine" },
    palette: ["#ededea", "#c7c5bf", "#d33030", "#0a0a0a"] },

  { key: "terminal",           label: "Terminal",            description: "CRT green, mono",
    categories: ["tech"],
    preview: { bg: "#0a0f0a", fg: "#3aff72", accent: "#3aff72", font: "mono", decoration: "terminal" },
    palette: ["#0a0f0a", "#142016", "#3aff72", "#081008"] },

  { key: "cyberpunk",          label: "Cyberpunk",           description: "Neon, scanlines, glitch",
    categories: ["tech"],
    preview: { bg: "#0a0a14", fg: "#00e0ff", accent: "#ff2d95", font: "mono", decoration: "scanlines" },
    palette: ["#0a0a14", "#1a1a2e", "#00e0ff", "#ff2d95"] },

  { key: "glassmorphism",      label: "Glassmorphism",       description: "Blur, gradients, frost",
    categories: ["tech"],
    preview: { bg: "linear-gradient(135deg, #d7c6ff 0%, #f2d8ec 100%)", fg: "#1a1a1a", accent: "#8b5cf6", font: "sans" },
    palette: ["#d7c6ff", "#f2d8ec", "#8b5cf6", "#ffffff"] },

  { key: "brutalist",          label: "Brutalist",           description: "Raw mono, hard grid",
    categories: ["tech", "editorial"],
    preview: { bg: "#e8e4dc", fg: "#0a0a0a", accent: "#e03a2e", font: "mono", decoration: "grid" },
    palette: ["#e8e4dc", "#b8b4a8", "#e03a2e", "#0a0a0a"] },

  { key: "memphis",            label: "Memphis",             description: "80s squiggles, confetti",
    categories: ["playful"],
    preview: { bg: "#fbdce0", fg: "#1a1a1a", accent: "#2dd4bf", font: "sans", decoration: "shapes" },
    palette: ["#fbdce0", "#ffb4c6", "#2dd4bf", "#f4c430", "#1a1a1a"] },

  { key: "maximalist",         label: "Maximalist",          description: "Layered, clashing, assertive",
    categories: ["playful"],
    preview: { bg: "#ffeb3b", fg: "#1a1a1a", accent: "#e4002b", font: "sans", decoration: "dots" },
    palette: ["#ffeb3b", "#7a1dcb", "#ff3d7f", "#1a1a1a"] },

  { key: "pop-art",            label: "Pop Art",             description: "Halftone, speech bubbles",
    categories: ["playful", "vintage"],
    preview: { bg: "#ffd83a", fg: "#0a0a0a", accent: "#e4002b", font: "sans", decoration: "dots" },
    palette: ["#ffd83a", "#ffffff", "#e4002b", "#0a0a0a"] },

  { key: "neon-miami",         label: "Neon Miami",          description: "Sunset gradients, chrome",
    categories: ["playful", "tech"],
    preview: { bg: "linear-gradient(180deg, #ffc1d6 0%, #ffd29a 55%, #9bcfff 100%)", fg: "#1a1a1a", accent: "#ff4e9a", font: "sans" },
    palette: ["#ffc1d6", "#ffd29a", "#9bcfff", "#ff4e9a", "#1a1a1a"] },

  { key: "vaporwave",          label: "Vaporwave",           description: "Pastel grids",
    categories: ["tech", "playful"],
    preview: { bg: "#cbb6ff", fg: "#1a1a1a", accent: "#ff4ec4", font: "sans", decoration: "vaporwave" },
    palette: ["#cbb6ff", "#ff4ec4", "#01cdfe", "#1a1a1a"] },

  { key: "y2k",                label: "Y2K",                 description: "Chrome, frutiger, bubble",
    categories: ["tech", "playful"],
    preview: { bg: "linear-gradient(135deg, #cfe3f5 0%, #f0f6fb 50%, #c3d8ed 100%)", fg: "#0b0b0b", accent: "#1e7bd6", font: "sans", decoration: "chrome" },
    palette: ["#cfe3f5", "#f0f6fb", "#1e7bd6", "#0b0b0b"] },

  { key: "art-deco",           label: "Art Deco",            description: "Gold, symmetry, geometry",
    categories: ["classic", "vintage"],
    preview: { bg: "#0b0b0b", fg: "#d4af37", accent: "#d4af37", font: "serif", decoration: "art-deco" },
    palette: ["#0b0b0b", "#1a1a1a", "#d4af37", "#8b6f1a"] },

  { key: "art-nouveau",        label: "Art Nouveau",         description: "Organic curves, botanical",
    categories: ["classic", "vintage"],
    preview: { bg: "#f1ecdf", fg: "#1d3b2a", accent: "#b89857", font: "serif" },
    palette: ["#f1ecdf", "#d4c6a0", "#b89857", "#1d3b2a"] },

  { key: "bauhaus",            label: "Bauhaus",             description: "Primary blocks, geometry",
    categories: ["classic"],
    preview: { bg: "#f4efe1", fg: "#0e0e0e", accent: "#e74c3c", font: "sans", decoration: "bauhaus" },
    palette: ["#f4efe1", "#e74c3c", "#2b6cb0", "#f1c40f", "#0e0e0e"] },

  { key: "medieval",           label: "Medieval",            description: "Parchment, illuminated",
    categories: ["vintage"],
    preview: { bg: "#e8dcc1", fg: "#3a2518", accent: "#a52a2a", font: "serif" },
    palette: ["#e8dcc1", "#c9b890", "#a52a2a", "#3a2518"] },

  { key: "victorian",          label: "Victorian",           description: "Ornaments, engravings",
    categories: ["vintage", "classic"],
    preview: { bg: "#f2e6ce", fg: "#2b1a0b", accent: "#7b2c2c", font: "serif" },
    palette: ["#f2e6ce", "#d9c69a", "#7b2c2c", "#2b1a0b"] },

  { key: "fashion",            label: "Fashion",             description: "Oversized type, hairlines",
    categories: ["editorial", "classic"],
    preview: { bg: "#f1ede4", fg: "#0a0a0a", accent: "#0a0a0a", font: "display", showAa: true },
    palette: ["#ffffff", "#f1ede4", "#d9d3c3", "#0a0a0a"] },

  { key: "grunge",             label: "Grunge",              description: "Distressed, torn, smudged",
    categories: ["vintage"],
    preview: { bg: "#7c746a", fg: "#1a1a1a", accent: "#4a2a1a", font: "mono", decoration: "noise" },
    palette: ["#7c746a", "#5a5246", "#4a2a1a", "#1a1a1a"] },

  { key: "skeuomorphic",       label: "Skeuomorphic",        description: "Tactile, shadows, paper",
    categories: ["tech", "classic"],
    preview: { bg: "#e6ddd0", fg: "#1f1f1f", accent: "#1d4ed8", font: "sans", decoration: "shadow" },
    palette: ["#e6ddd0", "#c9bfa8", "#1d4ed8", "#1f1f1f"] },
];

export function getDesignStyle(key: string | null | undefined): DesignStyle {
  const found = DESIGN_STYLES.find((s) => s.key === key);
  return found || DESIGN_STYLES[0];
}
