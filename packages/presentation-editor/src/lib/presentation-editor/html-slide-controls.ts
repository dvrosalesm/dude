import type { PptxContent, PptxHtmlShape, Slide } from "@dude/presentation-editor/types";

export type SlideControl =
  | { type: "text"; id: string; label: string; selector: string; value?: string }
  | { type: "color"; id: string; label: string; variable?: string; selector?: string; property?: string; value: string }
  | { type: "toggle"; id: string; label: string; selector: string; value: boolean };

const CONTROL_ATTR = "data-slide-control";
const SCRIPT_ID = "slide-controls";
const COLOR_VALUE_RE = /^(#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)|oklab\([^)]+\)|[a-z]+)$/i;
const DECORATIVE_HINT_RE = /(glow|grid|gradient|orb|ring|line|mesh|noise|decor|pattern|blob|shine|star|halo|pulse|trail)/i;

export function parseSlideControls(html: string): SlideControl[] {
  try {
    const match = html.match(/<script[^>]+id=["']slide-controls["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!match) return [];
    return JSON.parse(match[1]) as SlideControl[];
  } catch {
    return [];
  }
}

export function applyControlChange(html: string, control: SlideControl, newValue: string | boolean): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  if (control.type === "text" && typeof newValue === "string") {
    const el = doc.querySelector(control.selector);
    if (el) el.textContent = newValue;
  } else if (control.type === "color" && typeof newValue === "string") {
    if (control.variable) {
      const escaped = escapeRegExp(control.variable);
      for (const style of Array.from(doc.querySelectorAll("style"))) {
        const current = style.textContent || "";
        const next = current.replace(
          new RegExp(`(${escaped}\\s*:\\s*)([^;}\n]+)`),
          `$1${newValue}`,
        );
        if (next !== current) {
          style.textContent = next;
          break;
        }
      }
    }
    if (control.selector && control.property) {
      const el = doc.querySelector(control.selector) as HTMLElement | null;
      if (el) el.style.setProperty(control.property, newValue);
    }
  } else if (control.type === "toggle" && typeof newValue === "boolean") {
    doc.querySelectorAll(control.selector).forEach((el) => {
      (el as HTMLElement).style.display = newValue ? "" : "none";
    });
  }

  syncControlValues(doc, control.id, newValue);
  return serializeHtml(doc);
}

export function ensurePresentationHtmlSlideControls(content: PptxContent): {
  content: PptxContent;
  generatedShapeCount: number;
  generatedControlCount: number;
} {
  let generatedShapeCount = 0;
  let generatedControlCount = 0;

  const slides = content.slides.map((slide) => {
    const { slide: nextSlide, generatedShapes, generatedControls } = ensureSlideHtmlControls(slide);
    generatedShapeCount += generatedShapes;
    generatedControlCount += generatedControls;
    return nextSlide;
  });

  if (generatedShapeCount === 0) {
    return { content, generatedShapeCount: 0, generatedControlCount: 0 };
  }

  return {
    content: { ...content, slides },
    generatedShapeCount,
    generatedControlCount,
  };
}

function ensureSlideHtmlControls(slide: Slide): {
  slide: Slide;
  generatedShapes: number;
  generatedControls: number;
} {
  let generatedShapes = 0;
  let generatedControls = 0;

  const shapes = slide.shapes?.map((shape) => {
    if (shape.type !== "html") return shape;
    const ensured = ensureHtmlShapeControls(shape);
    if (!ensured.generated) return shape;
    generatedShapes += 1;
    generatedControls += ensured.controlCount;
    return ensured.shape;
  });

  if (!generatedShapes || !shapes) {
    return { slide, generatedShapes: 0, generatedControls: 0 };
  }

  return { slide: { ...slide, shapes }, generatedShapes, generatedControls };
}

function ensureHtmlShapeControls(shape: PptxHtmlShape): {
  shape: PptxHtmlShape;
  generated: boolean;
  controlCount: number;
} {
  if (parseSlideControls(shape.htmlContent).length > 0) {
    return { shape, generated: false, controlCount: 0 };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(shape.htmlContent, "text/html");
  const controls = buildAutomaticControls(doc);
  if (controls.length === 0) {
    return { shape, generated: false, controlCount: 0 };
  }

  const script = doc.createElement("script");
  script.id = SCRIPT_ID;
  script.type = "application/json";
  script.textContent = JSON.stringify(controls, null, 2);
  doc.body.appendChild(script);

  return {
    shape: { ...shape, htmlContent: serializeHtml(doc) },
    generated: true,
    controlCount: controls.length,
  };
}

function buildAutomaticControls(doc: Document): SlideControl[] {
  const controls: SlideControl[] = [];

  const textCandidates = getTextCandidates(doc).slice(0, 3);
  for (const [index, candidate] of textCandidates.entries()) {
    const marker = ensureMarker(doc, candidate.element, `text-${slugify(candidate.label || candidate.text) || index + 1}`);
    controls.push({
      type: "text",
      id: marker,
      label: candidate.label || fallbackTextLabel(index),
      selector: `[${CONTROL_ATTR}="${marker}"]`,
      value: candidate.text,
    });
  }

  const colorVariables = getColorVariables(doc).slice(0, 3);
  for (const variable of colorVariables) {
    controls.push({
      type: "color",
      id: `color-${slugify(variable.name)}`,
      label: prettifyVarName(variable.name),
      variable: variable.name,
      value: variable.value,
    });
  }

  const toggleCandidates = getToggleCandidates(doc).slice(0, 2);
  for (const [index, element] of toggleCandidates.entries()) {
    const sourceName =
      element.getAttribute("aria-label") ||
      element.id ||
      element.className ||
      `decoration ${index + 1}`;
    const marker = ensureMarker(doc, element, `toggle-${slugify(sourceName) || index + 1}`);
    controls.push({
      type: "toggle",
      id: marker,
      label: prettifyToken(sourceName),
      selector: `[${CONTROL_ATTR}="${marker}"]`,
      value: element.style.display !== "none" && !element.hasAttribute("hidden"),
    });
  }

  return controls;
}

function getTextCandidates(doc: Document): Array<{ element: Element; text: string; label: string }> {
  const elements = Array.from(doc.body.querySelectorAll("h1, h2, h3, p, blockquote, li, span, div"));
  const ranked = elements
    .map((element) => {
      const text = normalizeText(element.textContent || "");
      if (!isUsefulText(text)) return null;
      return {
        element,
        text,
        label: inferTextLabel(element),
        score: scoreTextElement(element, text),
      };
    })
    .filter((candidate): candidate is { element: Element; text: string; label: string; score: number } => Boolean(candidate))
    .sort((a, b) => b.score - a.score);

  const selected: Array<{ element: Element; text: string; label: string }> = [];
  for (const candidate of ranked) {
    if (selected.some((existing) => existing.element.contains(candidate.element) || candidate.element.contains(existing.element))) {
      continue;
    }
    selected.push(candidate);
    if (selected.length >= 3) break;
  }

  return selected;
}

function getColorVariables(doc: Document): Array<{ name: string; value: string }> {
  const styles = Array.from(doc.querySelectorAll("style"))
    .map((style) => style.textContent || "")
    .join("\n");
  const matches = styles.matchAll(/(--[a-z0-9-_]+)\s*:\s*([^;}\n]+)/gi);
  const deduped = new Map<string, string>();

  for (const match of matches) {
    const name = match[1];
    const value = match[2].trim();
    if (!COLOR_VALUE_RE.test(value)) continue;
    if (/(transparent|inherit|initial|unset|currentcolor)/i.test(value)) continue;
    if (!deduped.has(name)) deduped.set(name, value);
  }

  return Array.from(deduped.entries())
    .map(([name, value]) => ({ name, value, score: scoreColorVariable(name) }))
    .sort((a, b) => b.score - a.score)
    .map(({ name, value }) => ({ name, value }));
}

function getToggleCandidates(doc: Document): HTMLElement[] {
  const elements = Array.from(doc.body.querySelectorAll<HTMLElement>("[class], [id]"));
  return elements.filter((element) => {
    const name = `${element.id} ${element.className}`.trim();
    if (!name || !DECORATIVE_HINT_RE.test(name)) return false;
    const text = normalizeText(element.textContent || "");
    return text.length < 40;
  });
}

function scoreTextElement(element: Element, text: string): number {
  const tag = element.tagName.toLowerCase();
  const attrText = `${element.id} ${element.className}`.toLowerCase();
  let score = 0;

  if (tag === "h1") score += 100;
  else if (tag === "h2") score += 90;
  else if (tag === "h3") score += 80;
  else if (tag === "blockquote") score += 70;
  else if (tag === "p") score += 60;
  else if (tag === "li") score += 35;
  else if (tag === "span") score += 25;
  else score += 15;

  if (/(title|headline|hero|kicker|eyebrow|subtitle|subhead|label|stat|metric|value|quote)/.test(attrText)) {
    score += 25;
  }
  if (text.length >= 8 && text.length <= 90) score += 10;
  if (/\d/.test(text) && text.length <= 24) score += 10;
  if (text.length > 160) score -= 20;

  return score;
}

function inferTextLabel(element: Element): string {
  const attrText = `${element.id} ${element.className}`.toLowerCase();
  if (element.tagName.toLowerCase() === "h1" || /(title|headline|hero)/.test(attrText)) return "Title";
  if (/(subtitle|subhead|kicker|eyebrow)/.test(attrText)) return "Subtitle";
  if (/(stat|metric|value)/.test(attrText)) return "Stat";
  if (element.tagName.toLowerCase() === "blockquote") return "Quote";
  return "";
}

function fallbackTextLabel(index: number): string {
  return ["Title", "Subtitle", "Body"][index] || `Text ${index + 1}`;
}

function scoreColorVariable(name: string): number {
  const lowered = name.toLowerCase();
  if (/(accent|primary)/.test(lowered)) return 100;
  if (/(background|bg|surface)/.test(lowered)) return 90;
  if (/(text|foreground|fg|heading|title)/.test(lowered)) return 80;
  if (/(secondary|muted)/.test(lowered)) return 70;
  return 50;
}

function ensureMarker(doc: Document, element: Element, preferred: string): string {
  const existing = element.getAttribute(CONTROL_ATTR);
  if (existing) return existing;

  let marker = preferred || "control";
  let index = 2;
  while (doc.querySelector(`[${CONTROL_ATTR}="${marker}"]`)) {
    marker = `${preferred}-${index}`;
    index += 1;
  }
  element.setAttribute(CONTROL_ATTR, marker);
  return marker;
}

function syncControlValues(doc: Document, controlId: string, newValue: string | boolean) {
  try {
    const scriptEl = doc.querySelector(`script#${SCRIPT_ID}`);
    if (!scriptEl) return;
    const controls = JSON.parse(scriptEl.textContent || "[]") as SlideControl[];
    scriptEl.textContent = JSON.stringify(
      controls.map((control) => (control.id === controlId ? { ...control, value: newValue } : control)),
      null,
      2,
    );
  } catch {
    // Ignore malformed control blocks.
  }
}

function serializeHtml(doc: Document): string {
  return `<!DOCTYPE html><html><head>${doc.head.innerHTML}</head><body>${doc.body.innerHTML}</body></html>`;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isUsefulText(value: string): boolean {
  return value.length >= 3 && value.length <= 180 && /[a-z0-9]/i.test(value);
}

function prettifyVarName(name: string): string {
  return prettifyToken(name.replace(/^--/, ""));
}

function prettifyToken(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
