"use client";

import {
  addHtmlContentToSlide,
  setSlideTransition,
} from "./document-editor-rich-actions";
import { clearDocumentChanges } from "./document-editor-store-bridge";
import {
  deletePptxSlide,
  insertPptxSlide,
  reorderPptxSlide,
  resizePptxSlides,
  setSlideBackground,
  updatePptxSlideContent,
} from "./document-editor-slide-actions";
import { replaceTextInPptx } from "./document-editor-text-actions";
import type { ApplyEditResult } from "./document-editor-types";
import type { SlideTransition } from "@dude/presentation-editor/types";

export type SuggestedEdit =
  | { action: "replaceText"; searchText: string; replaceWith: string }
  | { action: "updatePptxSlide"; slideIndex: number; newContent: string }
  | { action: "insertPptxSlide"; afterSlideIndex: number | null; content: string }
  | { action: "deletePptxSlide"; slideIndex: number }
  | { action: "deleteSlides"; slideIndices: number[] }
  | { action: "reorderPptxSlide"; fromIndex: number; toIndex: number }
  | { action: "setSlideBackground"; slideIndex: number; color: string }
  | { action: "resizeSlides"; width: number; height: number }
  | { action: "addHtmlContent"; slideIndex: number; htmlContent: string; label?: string; position?: { x: number; y: number; cx: number; cy: number } }
  | { action: "setSlideTransition"; slideIndex: number; transition: SlideTransition }
  | { action: "clearChanges" };

export type SuggestedEditsBlock = { suggested_edits: SuggestedEdit[] };

/** Map clean action names → internal (legacy) names. */
const ACTION_ALIASES: Record<string, string> = {
  updateSlide: "updatePptxSlide",
  insertSlide: "insertPptxSlide",
  deleteSlide: "deletePptxSlide",
  reorderSlide: "reorderPptxSlide",
};

const KNOWN_ACTIONS = new Set([
  "replaceText",
  "updatePptxSlide",
  "insertPptxSlide",
  "deletePptxSlide",
  "deleteSlides",
  "reorderPptxSlide",
  "setSlideBackground",
  "resizeSlides",
  "addHtmlContent",
  "setSlideTransition",
  "clearChanges",
  // Clean aliases
  "updateSlide",
  "insertSlide",
  "deleteSlide",
  "reorderSlide",
]);
const MAX_SUGGESTED_EDITS = 500;
const MAX_STRING_FIELD_LENGTH = 500_000;

function isNonNegativeInteger(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && Number.isFinite(n);
}
function safeString(v: unknown, maxLen: number = MAX_STRING_FIELD_LENGTH): string {
  if (typeof v !== "string") return "";
  return v.length > maxLen ? v.slice(0, maxLen) : v;
}

/** Validate edits from an edit_presentation tool call (array format). */
export function validateEditsFromToolCall(edits: unknown[]): SuggestedEdit[] {
  return validateSuggestedEdits({ suggested_edits: edits });
}

export function validateSuggestedEdits(raw: unknown): SuggestedEdit[] {
  if (!raw || typeof raw !== "object" || !("suggested_edits" in raw)) return [];
  const arr = (raw as { suggested_edits: unknown }).suggested_edits;
  if (!Array.isArray(arr)) return [];
  const out: SuggestedEdit[] = [];
  const limit = Math.min(arr.length, MAX_SUGGESTED_EDITS);
  for (let i = 0; i < limit; i++) {
    const item = arr[i];
    if (!item || typeof item !== "object" || typeof (item as Record<string, unknown>).action !== "string") continue;
    let action = (item as Record<string, unknown>).action as string;
    if (!KNOWN_ACTIONS.has(action)) continue;
    // Normalize clean aliases to internal names
    if (ACTION_ALIASES[action]) action = ACTION_ALIASES[action];
    try {
      // --- deleteSlides (batch) → expand to individual deletePptxSlide entries ---
      if (action === "deleteSlides") {
        const slideIndices = (item as Record<string, unknown>).slideIndices;
        if (!Array.isArray(slideIndices)) continue;
        const validIndices = (slideIndices as unknown[]).filter(isNonNegativeInteger) as number[];
        if (!validIndices.length) continue;
        // Sort highest-first so indices don't shift — applySuggestedEdits handles this too, but be safe
        for (const idx of [...validIndices].sort((a, b) => b - a)) {
          out.push({ action: "deletePptxSlide", slideIndex: idx });
        }
        continue;
      }
      if (action === "replaceText") {
        out.push({
          action: "replaceText",
          searchText: safeString((item as Record<string, unknown>).searchText),
          replaceWith: safeString((item as Record<string, unknown>).replaceWith),
        });
      } else if (action === "updatePptxSlide") {
        const slideIndex = (item as Record<string, unknown>).slideIndex;
        if (!isNonNegativeInteger(slideIndex)) continue;
        out.push({
          action: "updatePptxSlide",
          slideIndex,
          newContent: safeString((item as Record<string, unknown>).newContent),
        });
      } else if (action === "insertPptxSlide") {
        const afterSlideIndex = (item as Record<string, unknown>).afterSlideIndex;
        const idx = afterSlideIndex === null ? null : isNonNegativeInteger(afterSlideIndex) ? afterSlideIndex : 0;
        out.push({
          action: "insertPptxSlide",
          afterSlideIndex: idx,
          content: safeString((item as Record<string, unknown>).content),
        });
      } else if (action === "deletePptxSlide") {
        const slideIndex = (item as Record<string, unknown>).slideIndex;
        if (!isNonNegativeInteger(slideIndex)) continue;
        out.push({ action: "deletePptxSlide", slideIndex });
      } else if (action === "reorderPptxSlide") {
        const fromIndex = (item as Record<string, unknown>).fromIndex;
        const toIndex = (item as Record<string, unknown>).toIndex;
        if (!isNonNegativeInteger(fromIndex) || !isNonNegativeInteger(toIndex)) continue;
        out.push({ action: "reorderPptxSlide", fromIndex, toIndex });
      } else if (action === "setSlideBackground") {
        const slideIndex = (item as Record<string, unknown>).slideIndex;
        if (!isNonNegativeInteger(slideIndex)) continue;
        out.push({
          action: "setSlideBackground",
          slideIndex,
          color: safeString((item as Record<string, unknown>).color, 20),
        });
      } else if (action === "resizeSlides") {
        const width = (item as Record<string, unknown>).width;
        const height = (item as Record<string, unknown>).height;
        if (typeof width !== "number" || typeof height !== "number" || width <= 0 || height <= 0) continue;
        out.push({ action: "resizeSlides", width, height });
      } else if (action === "addHtmlContent") {
        const slideIndex = (item as Record<string, unknown>).slideIndex;
        if (!isNonNegativeInteger(slideIndex)) continue;
        const htmlContent = safeString((item as Record<string, unknown>).htmlContent, MAX_STRING_FIELD_LENGTH);
        if (!htmlContent) continue;
        const label = safeString((item as Record<string, unknown>).label || "", 200) || undefined;
        const position = (item as Record<string, unknown>).position as { x: number; y: number; cx: number; cy: number } | undefined;
        out.push({ action: "addHtmlContent", slideIndex, htmlContent, label, position });
      } else if (action === "setSlideTransition") {
        const slideIndex = (item as Record<string, unknown>).slideIndex;
        if (!isNonNegativeInteger(slideIndex)) continue;
        const transition = (item as Record<string, unknown>).transition;
        if (!transition || typeof transition !== "object") continue;
        const t = transition as Record<string, unknown>;
        const type = safeString(t.type, 30);
        if (!VALID_TRANSITIONS.has(type as SlideTransitionType)) continue;
        const durationMs = typeof t.durationMs === "number" && t.durationMs > 0 && t.durationMs <= 5000 ? t.durationMs : undefined;
        const easing = typeof t.easing === "string" ? safeString(t.easing, 50) : undefined;
        out.push({ action: "setSlideTransition", slideIndex, transition: { type: type as SlideTransitionType, durationMs, easing } });
      } else if (action === "clearChanges") {
        out.push({ action: "clearChanges" });
      }
    } catch {
      // skip malformed entry
    }
  }
  return out;
}

export async function applySuggestedEdits(edits: SuggestedEdit[]): Promise<ApplyEditResult[]> {
  // Apply deletes last, highest-index-first, so earlier indices don't shift.
  const nonDeletes = edits.filter((e) => e.action !== "deletePptxSlide");
  const deletes = edits
    .filter((e) => e.action === "deletePptxSlide")
    .sort((a, b) => (b as { slideIndex: number }).slideIndex - (a as { slideIndex: number }).slideIndex);
  const ordered = [...nonDeletes, ...deletes];

  const results: ApplyEditResult[] = [];

  for (const edit of ordered) {
    if (edit.action === "replaceText") {
      results.push(replaceTextInPptx(edit.searchText, edit.replaceWith));
    } else if (edit.action === "updatePptxSlide") {
      results.push(updatePptxSlideContent(edit.slideIndex, edit.newContent));
    } else if (edit.action === "insertPptxSlide") {
      results.push(insertPptxSlide(edit.afterSlideIndex, edit.content));
    } else if (edit.action === "deletePptxSlide") {
      results.push(deletePptxSlide(edit.slideIndex));
    } else if (edit.action === "reorderPptxSlide") {
      results.push(reorderPptxSlide(edit.fromIndex, edit.toIndex));
    } else if (edit.action === "setSlideBackground") {
      results.push(setSlideBackground(edit.slideIndex, edit.color));
    } else if (edit.action === "resizeSlides") {
      results.push(resizePptxSlides(edit.width, edit.height));
    } else if (edit.action === "addHtmlContent") {
      results.push(addHtmlContentToSlide(edit.slideIndex, edit.htmlContent, edit.label, edit.position));
    } else if (edit.action === "setSlideTransition") {
      results.push(setSlideTransition(edit.slideIndex, edit.transition));
    } else if (edit.action === "clearChanges") {
      clearDocumentChanges();
      results.push({ success: true, message: "Document changes list cleared." });
    } else {
      results.push({
        success: false,
        error: `Unknown action: ${(edit as SuggestedEdit & { action: string }).action}`,
      });
    }
  }

  return results;
}

export function parseSuggestedEditsFromMessage(
  message: string
): SuggestedEdit[] | null {
  const jsonBlock = message.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (!jsonBlock) return null;
  try {
    const parsed = JSON.parse(jsonBlock[1].trim()) as unknown;
    const edits = validateSuggestedEdits(parsed);
    return edits.length > 0 ? edits : null;
  } catch {
    // ignore
  }
  return null;
}

