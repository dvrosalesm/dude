/**
 * Slide Preview — renders HTML slides via the shared html-preview browser
 * and asks a vision model to review the result.
 *
 * Used by generate_slide to self-correct before saving.
 */

import { renderHtmlToImage } from "./html-preview.js";
import { openRouterChat } from "@dude/sdk/gateway-runtime";

export { closeBrowser } from "./html-preview.js";

const REVIEW_MODEL = "google/gemini-3.1-flash-lite-preview";

/**
 * Render a slide HTML document to a PNG screenshot.
 * Returns a base64-encoded PNG string (no data: prefix).
 */
export async function renderSlideToImage(
  html: string,
  width = 1280,
  height = 720,
): Promise<string> {
  return renderHtmlToImage(html, { width, height, fullPage: false });
}

/**
 * Ask a vision model to review a slide screenshot.
 * Returns { ok: true } if the slide looks good, or { ok: false, feedback: "..." }
 * with specific issues to fix.
 */
export async function reviewSlideScreenshot(
  screenshotBase64: string,
  originalPrompt: string,
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
              text: `You are reviewing an HTML presentation slide. The slide was supposed to show: "${originalPrompt}"

Look at this screenshot and check for these issues:
1. Content not filling the slide (large empty/white gaps)
2. Text or elements overflowing outside the visible area (clipped content)
3. Broken layout (overlapping elements, unreadable text)
4. Completely blank or white slide
5. Content not matching what was requested

If the slide looks good and correctly shows the requested content, respond with exactly: OK

If there are issues, respond with a brief list of what's wrong and how to fix it. Be specific (e.g., "content only fills top 40% of slide, the bottom 60% is empty white space — make the layout fill the full height").

Do NOT be overly critical — minor styling preferences are fine. Only flag real layout/visibility problems.`,
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
      maxTokens: 300,
      temperature: 0.3,
      timeoutMs: 30_000,
    });
  } catch (err) {
    console.warn(`[slide-preview] Review skipped: ${err instanceof Error ? err.message : err}`);
    return { ok: true, feedback: "" };
  }

  if (answer.toUpperCase().startsWith("OK")) return { ok: true, feedback: "" };
  return { ok: false, feedback: answer };
}
