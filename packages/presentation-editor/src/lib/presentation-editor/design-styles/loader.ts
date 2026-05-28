import fs from "fs";
import path from "path";
import { DESIGN_STYLES, DEFAULT_DESIGN_STYLE, type DesignStyle } from "./index";

const STYLES_DIR = path.join(
  process.cwd(),
  "src/lib/presentation-editor/design-styles",
);

/**
 * Load the markdown guidelines for a design style. Returns null when the
 * style is unknown, its .md file is missing, or the file is empty (e.g. the
 * default style). Callers should fall back to baseline behavior in that case.
 */
export function loadDesignStyleGuidelines(
  key: string | null | undefined,
): { style: DesignStyle; body: string } | null {
  const resolvedKey = key || DEFAULT_DESIGN_STYLE;
  const style = DESIGN_STYLES.find((s) => s.key === resolvedKey);
  if (!style) return null;

  try {
    const filePath = path.join(STYLES_DIR, `${style.key}.md`);
    if (!fs.existsSync(filePath)) return null;
    const body = fs.readFileSync(filePath, "utf-8").trim();
    if (!body) return null;
    return { style, body };
  } catch {
    return null;
  }
}

/**
 * Build the prompt section injected into the agent's system prompt. Empty
 * string when no style (or the default style) is selected — the baseline
 * DESIGN PRINCIPLES block already covers neutral guidance.
 */
export function buildDesignStyleSection(
  key: string | null | undefined,
): string {
  const loaded = loadDesignStyleGuidelines(key);
  if (!loaded) return "";
  return [
    "",
    `## DESIGN STYLE — ${loaded.style.label.toUpperCase()}`,
    `The user selected the "${loaded.style.label}" style. Every slide you generate MUST follow the guidelines below. Override any conflicting default taste.`,
    "",
    loaded.body,
  ].join("\n");
}
