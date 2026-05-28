import { FONT_PAIRS, DEFAULT_FONT_PAIR, type FontPair } from "./index";

export function resolveFontPair(key: string | null | undefined): FontPair {
  const resolvedKey = key || DEFAULT_FONT_PAIR;
  return FONT_PAIRS.find((p) => p.key === resolvedKey) || FONT_PAIRS[0];
}

/**
 * Build the prompt section that pins typography for every slide the agent
 * generates. Returns "" when the system pair is selected (no override).
 */
export function buildFontPairSection(key: string | null | undefined): string {
  const pair = resolveFontPair(key);
  if (pair.key === DEFAULT_FONT_PAIR) return "";

  const importLine = pair.googleFontsUrl
    ? `@import url('${pair.googleFontsUrl}');`
    : "";

  return [
    "",
    `## TYPOGRAPHY — ${pair.label.toUpperCase()}`,
    `The user locked the typography to "${pair.label}". Every HTML slide MUST use these exact font families:`,
    `- **Display / headlines**: \`${pair.display}\``,
    `- **Body**: \`${pair.body}\``,
    "",
    "In every generate_slide HTML output, include this at the top of the `<style>` block so the fonts load:",
    "```css",
    importLine,
    `body, h1, h2, h3 { font-family: ${pair.display}; }`,
    `p, li, small, code, figcaption { font-family: ${pair.body}; }`,
    "```",
    "Do not substitute other fonts. Do not override these with system-ui unless a font fails to load (use the fallback chain already in the font-family value).",
  ].join("\n");
}
