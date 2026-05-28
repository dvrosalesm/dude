import { Type } from "@sinclair/typebox";
import { internalGet, internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { renderAndReviewLandingPage } from "./landing-page-review.js";
import { isApiError, toolText, wsPath } from "@dude/sdk/gateway-runtime";

export function createEditLandingPageTool(): ToolDefinition {
  return {
    name: "edit_landing_page",
    label: "Edit Landing Page",
    description:
      "Apply targeted search/replace edits to an existing landing page's HTML. " +
      "Much faster than regenerating the entire page — use this for changes " +
      "like updating text, colors, styles, or adding/removing sections.\n\n" +
      "ALWAYS batch ALL your edits into a SINGLE call to this tool. " +
      "Do NOT call this tool multiple times — put every edit in the edits array.\n\n" +
      "Each edit has:\n" +
      "- old_text: exact string to find in the current HTML (must match precisely including whitespace)\n" +
      "- new_text: replacement string (use empty string to delete)\n\n" +
      "RULES:\n" +
      "- Always use read_landing_page first to see the current HTML\n" +
      "- old_text must be UNIQUE in the HTML. If it matches multiple places, the edit will fail. " +
      "Include enough surrounding context (parent tags, nearby text) to make it unique\n" +
      "- Edits are applied in order, so later edits see the result of earlier ones\n\n" +
      "Example — multiple edits in ONE call:\n" +
      'edits: [\n' +
      '  { "old_text": "<h1>Old Title</h1>", "new_text": "<h1>New Title</h1>" },\n' +
      '  { "old_text": "background:#ff6b00", "new_text": "background:#e53e3e" },\n' +
      '  { "old_text": "<p>old paragraph</p>", "new_text": "<p>new paragraph</p>" }\n' +
      ']',
    parameters: Type.Object({
      landing_page_id: Type.String({
        description: "ID of the landing page to edit",
      }),
      edits: Type.Array(
        Type.Object({
          old_text: Type.String({
            description:
              "Exact text to find in the current HTML. Must be unique — include surrounding context if needed.",
          }),
          new_text: Type.String({
            description:
              "Replacement text. Use empty string to delete the matched text.",
          }),
        }),
        {
          description: "Array of search/replace edits to apply in order",
        },
      ),
    }),
    execute: async (_id: any, params: any) => {
      const result = await internalPost(wsPath("landing-page-edit"), params);

      if (isApiError(result) || result.applied === 0) return toolText(result);

      // Re-fetch the post-edit HTML from R2 and run a visual review so the
      // agent gets a feedback signal on whether the edits actually fixed
      // what was broken.
      let review: { ok: boolean; feedback: string } = { ok: true, feedback: "" };
      try {
        const htmlResult = await internalGet(
          wsPath("landing-page-html", params.landing_page_id),
        );
        const html = htmlResult.html;
        if (typeof html === "string" && html.length > 0) {
          const intent =
            params.edits && params.edits.length
              ? `applied ${params.edits.length} edit(s) to landing page`
              : "landing page";
          review = await renderAndReviewLandingPage(html, intent);
        }
      } catch {
        // Non-fatal — edits were applied successfully regardless
      }

      const reviewBlock = review.ok
        ? {}
        : {
            visualReview: "issues_found",
            reviewFeedback: review.feedback,
            reviewHint:
              "The page still has visible problems after these edits. Call edit_landing_page again with corrections BEFORE telling the user the page is ready.",
          };

      return toolText({ ...result, ...reviewBlock });
    },
  };
}
