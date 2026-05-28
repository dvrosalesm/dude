/**
 * Landing-page visual review — render saved HTML via the shared html-preview
 * browser and ask a vision model to flag layout/quality problems.
 *
 * Used by update_landing_page and edit_landing_page so the agent gets
 * automatic visual feedback after every save instead of designing blind.
 */

import { renderHtmlToImage } from "./html-preview.js";
import { openRouterChat } from "@dude/sdk/gateway-runtime";

const REVIEW_MODEL = "google/gemini-3.1-flash-lite-preview";

/**
 * Wrap a body-only HTML snippet in the same envelope used at render time
 * (capture-page-client.tsx and landing-page-preview.tsx) so the screenshot
 * matches what visitors actually see.
 */
function wrapBodyHtml(bodyHtml: string, styles?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; }
    ${styles || ""}
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

/**
 * Render saved landing-page HTML to a full-page PNG (base64, no data: prefix).
 *
 * `bodyHtml` is the body-only HTML the agent saved. It gets wrapped in the
 * standard envelope before rendering so the screenshot reflects what a
 * visitor sees on /capture/{id}.
 *
 * Width defaults to 1280 (desktop). Captures the full scrollable height,
 * which is the right default for landing pages.
 */
export async function renderLandingPageToImage(
  bodyHtml: string,
  styles?: string,
  width = 1280,
): Promise<string> {
  return renderHtmlToImage(wrapBodyHtml(bodyHtml, styles), {
    width,
    fullPage: true,
    settleMs: 400,
  });
}

/**
 * Ask a vision model to review the rendered landing page.
 *
 * Returns { ok: true } when the page looks acceptable, or
 * { ok: false, feedback: "..." } with a short list of concrete problems
 * the agent should fix with edit_landing_page.
 */
export async function reviewLandingPageScreenshot(
  screenshotBase64: string,
  intent: string,
): Promise<{ ok: boolean; feedback: string }> {
  let answer: string;
  try {
    answer = await openRouterChat({
      model: REVIEW_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are reviewing a landing page that was just generated. The user's intent was: "${intent}"

Look at this full-page screenshot and check for serious problems ONLY:

1. **Wall of text / missing structure** — content rendered as one big paragraph instead of distinct sections (hero, features, testimonials, CTA, footer). Marketing copy with line breaks but no semantic layout is the #1 failure mode.
2. **No styling** — looks like raw markdown / plain text on white background, no background colors, no spacing between sections, default browser fonts only.
3. **Broken layout** — elements overlapping, text overflowing containers, sections collapsed to a sliver, content cut off the right edge, fixed widths that exceed the viewport.
4. **Missing form / CTA area** — no visible form fields or submit button anywhere on the page (the page exists to capture leads).
5. **Empty placeholder text visible** — strings like "Form fields not configured yet", "{{placeholder}}", "[INSERT TEXT]", or "Lorem ipsum" left in the final output.
6. **Catastrophic contrast** — body text the same color as the background (invisible), or near-invisible.

If the page looks reasonable — has clear sections, varied backgrounds, readable type, a visible form area, and matches the intent — respond with exactly: OK

If there are serious problems, respond with a short list (1-4 bullets) of what's wrong and how to fix it. Be specific and actionable, e.g. "the entire body is one wall of text — wrap product benefits in a 3-column grid using <section><div class='grid'>..." or "form area shows the placeholder 'Form fields not configured yet' — call update_form_fields to add at least an email field."

Do NOT nitpick minor styling preferences (colors, exact spacing, copy choices). Only flag real layout / readability / missing-content failures.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${screenshotBase64}`,
              },
            },
          ],
        },
      ],
      maxTokens: 350,
      temperature: 0.3,
      timeoutMs: 30_000,
    });
  } catch (err) {
    console.warn(`[landing-page-review] Review skipped: ${err instanceof Error ? err.message : err}`);
    return { ok: true, feedback: "" };
  }

  if (answer.toUpperCase().startsWith("OK")) return { ok: true, feedback: "" };
  return { ok: false, feedback: answer };
}

/**
 * Render + review in one call. Soft-fails on errors (returns ok:true with
 * empty feedback) so a missing puppeteer or transient vision API hiccup
 * doesn't break the tool.
 */
export async function renderAndReviewLandingPage(
  bodyHtml: string,
  intent: string,
  styles?: string,
): Promise<{ ok: boolean; feedback: string }> {
  try {
    const screenshot = await renderLandingPageToImage(bodyHtml, styles);
    console.log(`[landing-page-review] Screenshot rendered (${Math.round(screenshot.length * 0.75 / 1024)}KB)`);
    return await reviewLandingPageScreenshot(screenshot, intent);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[landing-page-review] Skipped: ${message}`);
    return { ok: true, feedback: "" };
  }
}
