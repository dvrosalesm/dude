/**
 * Heuristic quality signals for HTML slides + repair prompt for a follow-up agent turn.
 */

import type { DocumentContent, PptxContent, Slide, PptxSlideShape } from "@dude/presentation-editor/types";

export interface SlideQualityIssue {
  slideIndex: number;
  reasons: string[];
}

export interface PresentationQualityResult {
  ok: boolean;
  issues: SlideQualityIssue[];
  repairUserMessage: string;
}

function stripScriptsAndStyles(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");
}

/** Detect very small font sizes in px (likely unreadable on carousel / phone). */
function hasTinyFontPx(html: string): boolean {
  const s = stripScriptsAndStyles(html);
  const re = /font-size\s*:\s*(\d+(?:\.\d+)?)\s*px/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = parseFloat(m[1]);
    if (n > 0 && n < 24) return true;
  }
  return false;
}

/** Row of cards / flex row with multiple children (carousel anti-pattern). */
function looksLikeHorizontalCardRow(html: string): boolean {
  const s = stripScriptsAndStyles(html).toLowerCase();
  if (/flex-direction\s*:\s*row/.test(s) && /grid-template-columns/.test(s)) return true;
  if (/\bflex\s*:\s*1\b/.test(s) && /display\s*:\s*flex/.test(s) && (s.match(/border-radius/g) || []).length >= 3)
    return true;
  return false;
}

function htmlShapeContent(slide: Slide): string | null {
  for (const sh of slide.shapes || []) {
    if ((sh as PptxSlideShape).type === "html") {
      return (sh as { htmlContent?: string }).htmlContent || "";
    }
  }
  return null;
}

/** Landscape-style bottom anchor on a portrait slide. */
function looksBottomPinnedPortrait(html: string): boolean {
  const s = stripScriptsAndStyles(html).toLowerCase();
  if (/justify-content\s*:\s*(flex-end|end)/.test(s)) return true;
  if (/align-items\s*:\s*(flex-end|end)/.test(s) && /min-height\s*:\s*100(vh|dvh|svh)/.test(s)) return true;
  return false;
}

/** Icon + text in horizontal rows (landscape habit on portrait canvas). */
/** Header + footer pinned with space-between → empty middle "sandwich". */
function looksLikeSandwichLayout(html: string): boolean {
  const s = stripScriptsAndStyles(html).toLowerCase();
  if (!/justify-content\s*:\s*space-between/.test(s)) return false;
  if (!/min-height\s*:\s*100(vh|dvh|svh|%)/.test(s) && !/height\s*:\s*100%/.test(s)) return false;
  return true;
}

/** Empty img src, missing src, or obvious missing portrait asset. */
function hasEmptyOrBrokenImgSrc(html: string): boolean {
  const s = stripScriptsAndStyles(html);
  if (/<img[^>]*\ssrc\s*=\s*["']\s*["']/i.test(s)) return true;
  if (/<img[^>]*\ssrc\s*=\s*["']about:blank["']/i.test(s)) return true;
  const tags = s.match(/<img\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (!/\ssrc\s*=/i.test(tag)) return true;
    const m = tag.match(/\ssrc\s*=\s*["']([^"']*)["']/i);
    if (m && m[1].trim() === "") return true;
  }
  return false;
}

/** Many crew-style circular avatars in one horizontal flex row (portrait anti-pattern). */
function looksLikeHorizontalCrewRow(html: string): boolean {
  const s = stripScriptsAndStyles(html).toLowerCase();
  if (!/flex-direction\s*:\s*row/.test(s)) return false;
  const imgs = (html.match(/<img\b/gi) || []).length;
  if (imgs >= 3 && /border-radius\s*:\s*50%|circle/.test(s)) return true;
  return false;
}

function looksLikeHorizontalIconRow(html: string): boolean {
  const s = stripScriptsAndStyles(html).toLowerCase();
  const rowUses = (s.match(/flex-direction\s*:\s*row/g) || []).length;
  if (rowUses === 0) return false;
  if (rowUses >= 2) return true;
  return (
    /align-items\s*:\s*center/.test(s) &&
    /gap\s*:/.test(s) &&
    /flex-direction\s*:\s*row/.test(s)
  );
}

function initialsOnlyAvatars(html: string): boolean {
  const s = stripScriptsAndStyles(html);
  if (/<img\s/i.test(s)) return false;
  const cardLike = (s.match(/\bcard\b/gi) || []).length >= 2 || (s.match(/border-radius:\s*50%/g) || []).length >= 2;
  if (!cardLike) return false;
  return /[A-Z]{2}/.test(s);
}

export function evaluatePresentationQuality(
  content: DocumentContent,
  slideDimensions?: { width: number; height: number },
): PresentationQualityResult {
  const pptx = content as PptxContent;
  const slides = pptx.slides || [];
  const isPortrait = slideDimensions ? slideDimensions.height > slideDimensions.width : false;
  const isSquare = slideDimensions ? slideDimensions.width === slideDimensions.height : false;
  const carouselMode = isPortrait || isSquare;

  const issues: SlideQualityIssue[] = [];

  slides.forEach((slide, slideIndex) => {
    const html = htmlShapeContent(slide);
    if (!html) return;
    const reasons: string[] = [];

    if (carouselMode) {
      if (hasTinyFontPx(html)) reasons.push("Font sizes below 24px in HTML — illegible on phone carousel");
      if (looksLikeHorizontalCardRow(html)) reasons.push("Horizontal multi-card / row layout — carousel mode requires vertical stack only");
      if (looksLikeSandwichLayout(html)) reasons.push("Sandwich layout (space-between + full height) — causes empty middle; use flex-start + gap, integrate stats into flow, fill vertical space");
      if (looksBottomPinnedPortrait(html)) reasons.push("Content pinned to bottom (flex-end) — portrait slides should not mimic 16:9 lower-third layouts; use flex-start + gap or true vertical center");
      if (looksLikeHorizontalIconRow(html)) reasons.push("Horizontal flex-row (icon + text) — stack vertically for portrait carousel, not landscape-style rows");
      if (looksLikeHorizontalCrewRow(html)) reasons.push("Horizontal row of multiple portrait/avatar images — stack crew as full-width vertical sections on tall slides");
      if (hasEmptyOrBrokenImgSrc(html)) reasons.push("Empty or invalid img src — use real image URLs from web_search or a non-photo layout; no blank portrait circles");
      if (initialsOnlyAvatars(html)) reasons.push("Initials-only roster without photos — use real portraits or a single editorial layout");
    } else if (initialsOnlyAvatars(html)) {
      reasons.push("Team slide uses initials-only avatars — prefer real images or a stronger typographic treatment");
    }

    if (reasons.length) issues.push({ slideIndex, reasons });
  });

  const repairLines: string[] = [
    "[Automatic quality review — fix these issues without changing the user’s factual content.]",
    "Use read_slide for each affected slide, then edit_presentation with addHtmlContent to replace weak HTML.",
    "Follow SOCIAL MEDIA CAROUSEL MODE rules if the deck is portrait/square; otherwise follow LANDSCAPE PRESENTATION MODE.",
    "",
  ];
  for (const iss of issues) {
    repairLines.push(`Slide ${iss.slideIndex + 1} (0-based index ${iss.slideIndex}):`);
    iss.reasons.forEach((r) => repairLines.push(`- ${r}`));
    repairLines.push("");
  }

  return {
    ok: issues.length === 0,
    issues,
    repairUserMessage: repairLines.join("\n").trim(),
  };
}
