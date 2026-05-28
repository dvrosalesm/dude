import { Type } from "@sinclair/typebox";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { renderAndReviewLandingPage } from "./landing-page-review.js";
import { isApiError, toolText, wsPath } from "@dude/sdk/gateway-runtime";

const PAGES_DIR = "/app/landing-pages";

export function createUpdateLandingPageTool(): ToolDefinition {
  return {
    name: "update_landing_page",
    label: "Update Landing Page",
    description:
      "Create or update a landing page. Provide HTML for the page body, plus optional " +
      "CSS styles, title, and description. The HTML must include the form placeholder " +
      '<div id="capture-form"></div> where the system injects configured form fields.\n\n' +
      "PREFERRED USAGE — sectioned workflow for full sites:\n" +
      "For any multi-section landing page (hero + features + testimonials + pricing + ...), " +
      "use this tool ONCE to create a small SKELETON only (target: under 3 KB), then call " +
      "append_landing_page_section ONCE PER SECTION to fill in content. This avoids output " +
      "token truncation on long single-shot generations.\n\n" +
      "A good skeleton contains:\n" +
      "  - <head> with meta tags + a global <style> block (palette, typography, base layout)\n" +
      "  - <header> / <nav>\n" +
      "  - An empty <main> with the markers:\n" +
      "      <main>\n" +
      "        <!-- SECTIONS_START -->\n" +
      "        <!-- SECTIONS_END -->\n" +
      "      </main>\n" +
      "  - <div id=\"capture-form\"></div>\n" +
      "  - <footer>\n\n" +
      "ONE-SHOT USAGE (only for short single-section pages — thank-you, 404, etc.): " +
      "you can put the whole page body in html directly. Avoid this for any page with " +
      "more than one major section.\n\n" +
      "Pass id to update an existing page; omit to create a new one. " +
      "After creation, the page is saved to /app/landing-pages/{id}.html for direct file edits.",
    parameters: Type.Object({
      id: Type.Optional(
        Type.String({
          description:
            "Landing page ID to update. Omit to create a new page.",
        }),
      ),
      title: Type.String({
        description: "Landing page title (shown in browser tab)",
      }),
      description: Type.Optional(
        Type.String({
          description: "Short description of the landing page purpose",
        }),
      ),
      html: Type.String({
        description:
          'Full HTML body content. Must include <div id="capture-form"></div> where the form will be injected.',
      }),
      styles: Type.Optional(
        Type.String({ description: "CSS styles for the landing page" }),
      ),
    }),
    execute: async (_id: any, params: any) => {
      // Save to R2 + workspace config via internal API
      const result = await internalPost(wsPath("landing-page"), params);

      if (isApiError(result)) return toolText(result);

      const pageId = (result.id as string | undefined) || params.id;

      // Visual review — render the saved HTML and ask a vision model to flag
      // serious layout/quality issues so the agent can self-correct via
      // edit_landing_page instead of declaring the page "ready" while it's
      // actually a wall of text. Soft-fails: if puppeteer or the review API
      // is unavailable, the tool still returns success.
      const intent = `${params.title || ""}${params.description ? ` — ${params.description}` : ""}`.trim();
      const review = params.html
        ? await renderAndReviewLandingPage(params.html, intent || params.title || "landing page", params.styles)
        : { ok: true, feedback: "" };

      // Write local file so the agent can edit it directly
      let localFileHint: { localFile?: string; hint?: string } = {};
      if (pageId && params.html) {
        try {
          await mkdir(PAGES_DIR, { recursive: true });
          const filePath = join(PAGES_DIR, `${pageId}.html`);
          const fullHtml = params.styles
            ? `<style>${params.styles}</style>\n${params.html}`
            : params.html;
          await writeFile(filePath, fullHtml, "utf-8");
          localFileHint = {
            localFile: filePath,
            hint: `Page saved. To make edits, modify ${filePath} directly, then call save_landing_page to publish your changes.`,
          };
        } catch {
          // Local file write failed — not critical, R2 save succeeded
        }
      }

      const reviewBlock = review.ok
        ? {}
        : {
            visualReview: "issues_found",
            reviewFeedback: review.feedback,
            reviewHint:
              "The rendered page has visible problems. Call edit_landing_page to fix them BEFORE telling the user the page is ready.",
          };

      return toolText({ ...result, ...localFileHint, ...reviewBlock });
    },
  };
}
