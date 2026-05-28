import type {
  DesignStyle,
  DesignStyleCategory,
  DesignStyleDecoration,
  DesignStyleFont,
} from "@dude/presentation-editor/lib/design-styles";

const ALLOWED_FONTS: DesignStyleFont[] = ["sans", "serif", "mono", "display"];
const ALLOWED_DECORATIONS: DesignStyleDecoration[] = [
  "none", "grid", "scanlines", "dots", "noise", "columns",
  "shapes", "chrome", "shadow", "terminal", "bauhaus",
  "art-deco", "vaporwave", "zine",
];
const ALLOWED_CATEGORIES: DesignStyleCategory[] = [
  "classic", "editorial", "tech", "playful", "vintage",
];

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const GRADIENT_RE = /^linear-gradient\s*\([^)]{1,400}\)$/i;

function isHex(v: unknown): v is string {
  return typeof v === "string" && HEX_RE.test(v);
}

function isBgValue(v: unknown): v is string {
  return typeof v === "string" && (HEX_RE.test(v) || GRADIENT_RE.test(v));
}

export type GenerateDesignSystemResult =
  | { ok: true; style: DesignStyle; markdown: string }
  | { ok: false; error: string };

function buildCustomStyleMarkdown(style: DesignStyle, brief: string): string {
  const { bg, fg, accent, font, decoration, showAa } = style.preview;
  const lines = [
    `# ${style.label} — Custom Design System`,
    "",
    style.description,
    "",
    "## Intent",
    brief.trim(),
    "",
    "## Palette",
    `- Background: ${bg}`,
    `- Foreground text: ${fg}`,
    `- Accent: ${accent}`,
    `- Full palette: ${style.palette.join(", ")}`,
    "",
    "## Typography",
    `- Font family: ${font}${showAa ? " (typography is a hero element — oversize headlines, tight tracking)" : ""}`,
    "",
    "## Decoration",
    decoration && decoration !== "none"
      ? `- Use "${decoration}" visual treatment consistently across slides.`
      : "- Keep decoration minimal.",
    "",
    "## Rules",
    "- Apply this palette and typography on every slide — do not introduce colors outside the palette.",
    "- Keep foreground/background contrast high; never place low-contrast text on the hero region.",
    "- Reuse the accent color for emphasis (CTAs, highlights, numbers) — sparingly, not decoratively.",
    "- Match the mood in the Intent section; every slide should feel like it belongs to the same deck.",
  ];
  return lines.join("\n");
}

export async function generateCustomDesignSystem(
  brief: string,
): Promise<GenerateDesignSystemResult> {
  const trimmed = brief.trim();
  if (!trimmed) return { ok: false, error: "empty brief" };
  if (trimmed.length > 2000) return { ok: false, error: "brief too long" };

  const lower = trimmed.toLowerCase();
  const isDreamy = /\b(dream|soft|mist|ambient|ethereal|surreal)\b/.test(lower);
  const isTerminal = /\b(terminal|code|cli|mono|technical|developer)\b/.test(lower);
  const isEditorial = /\b(editorial|magazine|fashion|luxury|story)\b/.test(lower);

  const label = isDreamy
    ? "Dream Logic"
    : isTerminal
      ? "Terminal Glow"
      : isEditorial
        ? "Quiet Editorial"
        : "Custom";
  const description = isDreamy
    ? "soft dark atmosphere"
    : isTerminal
      ? "coded monochrome system"
      : isEditorial
        ? "refined narrative layout"
        : "tailored presentation system";
  const categories: DesignStyleCategory[] = [
    isTerminal ? "tech" : isEditorial ? "editorial" : "classic",
  ];
  const bg = isDreamy ? "#151515" : isTerminal ? "#080808" : "#f5efe4";
  const fg = isDreamy || isTerminal ? "#F3F3F3" : "#0a0a0a";
  const accent = isDreamy ? "#D7D1C8" : isTerminal ? "#E7C59A" : "#d4a94a";
  const font: DesignStyleFont = isEditorial ? "serif" : isTerminal ? "mono" : "sans";
  const decoration: DesignStyleDecoration | undefined = isDreamy
    ? "noise"
    : isTerminal
      ? "terminal"
      : "none";
  const showAa = isEditorial;
  const palette = isDreamy
    ? ["#080808", "#151515", "#4D4D4D", "#D7D1C8", "#F3F3F3"]
    : isTerminal
      ? ["#080808", "#101010", "#333333", "#E7C59A", "#F3F3F3"]
      : ["#f5efe4", "#d4a94a", "#262626", "#0a0a0a"];

  const style: DesignStyle = {
    key: `custom-${Date.now().toString(36)}`,
    label,
    description,
    categories,
    preview: { bg, fg, accent, font, decoration, showAa },
    palette,
  };

  const markdown = buildCustomStyleMarkdown(style, trimmed);

  return { ok: true, style, markdown };
}
