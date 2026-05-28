/**
 * Landing page HTML storage on local disk.
 *
 * Each landing page is stored as a single HTML file at:
 *   landing-pages/{workspaceId}/{pageId}/index.html
 *
 * The workspace config only keeps lightweight metadata (title, fields, published).
 */

import {
  deleteLocalBlob,
  readLocalBlob,
  writeLocalBlob,
} from "./local-blob-store.js";

function pageKey(workspaceId: string, pageId: string): string {
  return `landing-pages/${workspaceId}/${pageId}/index.html`;
}

function draftKey(workspaceId: string): string {
  return `landing-pages/${workspaceId}/_draft.html`;
}

const CAPTURE_FORM_DIV_RE =
  /<div\s+id\s*=\s*["']capture-form["']\s*>\s*<\/div>/gi;

/**
 * The form-injection pipeline (preview + public capture page) only replaces the
 * FIRST <div id="capture-form"></div> it finds; any extras stay as empty divs
 * and visually break the layout. Agents sometimes emit the placeholder both in
 * the skeleton and inside an appended "form" section, so we keep only the
 * first occurrence here.
 */
export function dedupeCaptureFormPlaceholder(html: string): string {
  let seen = false;
  return html.replace(CAPTURE_FORM_DIV_RE, () => {
    if (seen) return "";
    seen = true;
    return '<div id="capture-form"></div>';
  });
}

export async function saveLandingPageHtml(
  workspaceId: string,
  pageId: string,
  html: string,
  styles?: string,
): Promise<void> {
  const deduped = dedupeCaptureFormPlaceholder(html);
  const fullHtml = styles
    ? `<style>${styles}</style>\n${deduped}`
    : deduped;

  await writeLocalBlob(pageKey(workspaceId, pageId), fullHtml);
}

export async function getLandingPageHtml(
  workspaceId: string,
  pageId: string,
): Promise<string | null> {
  const blob = await readLocalBlob(pageKey(workspaceId, pageId));
  return blob ? blob.toString("utf8") : null;
}

/**
 * Apply search/replace edits to a landing page's HTML in-place on disk.
 */
export async function applyLandingPageEdits(
  workspaceId: string,
  pageId: string,
  edits: Array<{ old_text: string; new_text: string }>,
): Promise<{ applied: number; failed: number; errors: string[] }> {
  let html = await getLandingPageHtml(workspaceId, pageId);
  if (!html) {
    throw new Error(`Landing page ${pageId} not found in storage`);
  }

  let applied = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    if (!edit.old_text) {
      failed++;
      errors.push(`Edit ${i + 1}: old_text is empty`);
      continue;
    }

    const firstIdx = html.indexOf(edit.old_text);
    if (firstIdx === -1) {
      failed++;
      errors.push(
        `Edit ${i + 1}: old_text not found — check for exact whitespace/indentation`,
      );
      continue;
    }

    const secondIdx = html.indexOf(edit.old_text, firstIdx + 1);
    if (secondIdx !== -1) {
      failed++;
      errors.push(
        `Edit ${i + 1}: old_text matches multiple locations — include more surrounding context to make it unique`,
      );
      continue;
    }

    html =
      html.slice(0, firstIdx) +
      edit.new_text +
      html.slice(firstIdx + edit.old_text.length);
    applied++;
  }

  if (applied > 0) {
    const deduped = dedupeCaptureFormPlaceholder(html);
    await writeLocalBlob(pageKey(workspaceId, pageId), deduped);
  }

  return { applied, failed, errors };
}

export async function saveLandingPageDraft(
  workspaceId: string,
  html: string,
): Promise<void> {
  await writeLocalBlob(draftKey(workspaceId), html);
}

export async function deleteLandingPageHtml(
  workspaceId: string,
  pageId: string,
): Promise<void> {
  await deleteLocalBlob(pageKey(workspaceId, pageId));
}
