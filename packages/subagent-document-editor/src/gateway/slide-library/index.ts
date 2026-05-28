/**
 * Slide Library — curated reference slide HTML organized by style and category.
 *
 * The library is consulted by `generate_slide.ts` to pass 2–3 high-quality
 * examples alongside the user prompt, as few-shot references for the HTML
 * generator model.
 *
 * Catalog shape: `catalog.json` alongside this file.
 * HTML files: `slides/<category>/<style>-<variant>.html`.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type Orientation = "horizontal" | "vertical";

export interface CatalogSlide {
  id: string;
  file: string;
  style: string;
  category: string;
  tags: string[];
  description: string;
  /** Defaults to "horizontal" when missing. */
  orientation?: Orientation;
}

export interface StyleMeta {
  label: string;
  keywords: string[];
  palette: string[];
  voice: string;
  /** When set, this style is only available for these orientations. */
  orientations?: Orientation[];
}

export interface CategoryMeta {
  label: string;
  aliases: string[];
  /** When set, this category is only meaningful for these orientations. */
  orientations?: Orientation[];
}

export interface CanvasDef {
  width: number;
  height: number;
  aspect: string;
  usage?: string;
}

export interface Catalog {
  version: number;
  generatedAt: string;
  /** Legacy single-canvas field kept for backwards compatibility. */
  canvas?: CanvasDef;
  /** Per-orientation canvas definitions. */
  canvases?: Record<Orientation, CanvasDef>;
  styles: Record<string, StyleMeta>;
  categories: Record<string, CategoryMeta>;
  slides: CatalogSlide[];
}

let _catalog: Catalog | null = null;

async function loadCatalog(): Promise<Catalog> {
  if (_catalog) return _catalog;
  const path = join(__dirname, "catalog.json");
  const raw = await readFile(path, "utf8");
  _catalog = JSON.parse(raw) as Catalog;
  return _catalog;
}

async function loadSlideHtml(relFile: string): Promise<string> {
  const path = join(__dirname, relFile);
  return readFile(path, "utf8");
}

/**
 * Normalize a prompt into lowercase tokens for cheap keyword matching.
 * Strips punctuation, keeps hyphenated words as single tokens, and emits
 * bigrams (word pairs joined by "-") so multi-word concepts like "tier list"
 * match aliases such as "tier-list".
 */
function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]}-${words[i + 1]}`);
  }
  return [...words, ...bigrams];
}

export interface RetrievalOptions {
  /** How many reference slides to return. Default 3. */
  k?: number;
  /** If set, only return slides whose category matches (after alias resolution). */
  category?: string;
  /** If set, prefer slides of this style; others can still match with a penalty. */
  style?: string;
  /** If set, only return slides for this orientation. */
  orientation?: Orientation;
}

/** Infer orientation from a canvas aspect ratio. */
export function orientationFromDimensions(width: number, height: number): Orientation {
  return height > width ? "vertical" : "horizontal";
}

function slideOrientation(slide: CatalogSlide): Orientation {
  return slide.orientation ?? "horizontal";
}

export interface RetrievalResult {
  slide: CatalogSlide;
  score: number;
  html: string;
}

/** Resolve a category key from an alias (e.g. "thank-you" -> "closing"). */
function resolveCategory(input: string, cats: Record<string, CategoryMeta>): string | null {
  const key = input.toLowerCase().trim();
  if (cats[key]) return key;
  for (const [name, meta] of Object.entries(cats)) {
    if (meta.aliases.includes(key)) return name;
  }
  return null;
}

/** Detect style/category hints from the prompt itself (best-effort). */
function inferHints(prompt: string, catalog: Catalog): { style?: string; category?: string } {
  const tokens = new Set(tokenize(prompt));
  let bestStyle: { key: string; hits: number } | null = null;
  for (const [key, meta] of Object.entries(catalog.styles)) {
    let hits = 0;
    for (const kw of meta.keywords) {
      if (tokens.has(kw) || tokens.has(kw.replace(/-/g, ""))) hits++;
    }
    if (hits > 0 && (!bestStyle || hits > bestStyle.hits)) {
      bestStyle = { key, hits };
    }
  }

  let bestCat: { key: string; hits: number } | null = null;
  for (const [key, meta] of Object.entries(catalog.categories)) {
    let hits = 0;
    if (tokens.has(key)) hits += 2;
    for (const alias of meta.aliases) {
      if (tokens.has(alias) || tokens.has(alias.replace(/-/g, ""))) hits++;
    }
    if (hits > 0 && (!bestCat || hits > bestCat.hits)) {
      bestCat = { key, hits };
    }
  }

  return { style: bestStyle?.key, category: bestCat?.key };
}

/** Score a catalog slide against a prompt using tag overlap + style/category bonuses. */
function scoreSlide(
  slide: CatalogSlide,
  promptTokens: Set<string>,
  preferredStyle: string | undefined,
  requiredCategory: string | undefined,
): number {
  if (requiredCategory && slide.category !== requiredCategory) return -Infinity;

  let score = 0;
  for (const tag of slide.tags) {
    const parts = tag.toLowerCase().split(/[-\s]/);
    for (const p of parts) {
      if (p.length > 2 && promptTokens.has(p)) score += 2;
    }
    if (promptTokens.has(tag.toLowerCase())) score += 3;
  }
  for (const w of tokenize(slide.description)) {
    if (promptTokens.has(w)) score += 0.5;
  }
  if (preferredStyle && slide.style === preferredStyle) score += 6;
  if (requiredCategory && slide.category === requiredCategory) score += 4;
  return score;
}

/**
 * Return up to `k` reference slides for a prompt, each with its full HTML.
 * Uses prompt token overlap plus optional style/category hints.
 */
export async function findRelevantSlides(
  prompt: string,
  options: RetrievalOptions = {},
): Promise<RetrievalResult[]> {
  const catalog = await loadCatalog();
  const k = options.k ?? 3;

  const hints = inferHints(prompt, catalog);
  const preferredStyle = options.style ?? hints.style;
  const requiredCategory = options.category
    ? resolveCategory(options.category, catalog.categories) ?? undefined
    : hints.category;

  const promptTokens = new Set(tokenize(prompt));
  const orientation = options.orientation;

  const scored = catalog.slides
    .filter((s) => !orientation || slideOrientation(s) === orientation)
    .map((s) => ({ slide: s, score: scoreSlide(s, promptTokens, preferredStyle, requiredCategory) }))
    .filter((x) => Number.isFinite(x.score));

  scored.sort((a, b) => b.score - a.score);

  // Diversify: avoid returning multiple slides of the same category when we have
  // plenty to choose from, unless the caller explicitly required one.
  const picked: typeof scored = [];
  const seenCategories = new Set<string>();
  for (const entry of scored) {
    if (picked.length >= k) break;
    if (!requiredCategory && seenCategories.has(entry.slide.category) && picked.length < k - 1) {
      continue;
    }
    picked.push(entry);
    seenCategories.add(entry.slide.category);
  }

  const results = await Promise.all(
    picked.map(async (p) => ({
      slide: p.slide,
      score: p.score,
      html: await loadSlideHtml(p.slide.file),
    })),
  );

  return results;
}

/**
 * Format a list of retrieved slides as a few-shot reference block suitable
 * for inclusion in the system prompt sent to the content generator.
 */
export function formatFewShotBlock(results: RetrievalResult[]): string {
  if (!results.length) return "";
  const sections = results.map((r, i) => {
    return `### Reference ${i + 1} — ${r.slide.style} · ${r.slide.category}
${r.slide.description}

\`\`\`html
${r.html}
\`\`\``;
  });
  return `## Reference slides (for inspiration only — do not copy verbatim)
Use the *structure, hierarchy, and visual rhythm* of these examples. Adapt the content to the user's prompt. Match the requested design system exactly — these are only structural inspirations.

${sections.join("\n\n")}`;
}

export async function getCatalog(): Promise<Catalog> {
  return loadCatalog();
}
