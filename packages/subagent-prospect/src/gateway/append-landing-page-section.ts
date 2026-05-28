import { Type } from "@sinclair/typebox";
import { internalGet, internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { renderAndReviewLandingPage } from "./landing-page-review.js";
import { isApiError, toolError, toolText, wsPath } from "@dude/sdk/gateway-runtime";

const SECTIONS_END_MARKER = "<!-- SECTIONS_END -->";
const SECTIONS_START_MARKER = "<!-- SECTIONS_START -->";

function insertSection(html: string, content: string): string {
  if (html.includes(SECTIONS_END_MARKER)) {
    return html.replace(
      SECTIONS_END_MARKER,
      `${content}\n${SECTIONS_END_MARKER}`,
    );
  }
  const mainEnd = html.lastIndexOf("</main>");
  if (mainEnd !== -1) {
    return html.slice(0, mainEnd) + content + "\n" + html.slice(mainEnd);
  }
  const captureFormIdx = html.indexOf('<div id="capture-form"></div>');
  if (captureFormIdx !== -1) {
    return html.slice(0, captureFormIdx) + content + "\n" + html.slice(captureFormIdx);
  }
  const bodyEnd = html.lastIndexOf("</body>");
  if (bodyEnd !== -1) {
    return html.slice(0, bodyEnd) + content + "\n" + html.slice(bodyEnd);
  }
  return html + "\n" + content;
}

function replaceOrAppendSection(
  html: string,
  sectionId: string,
  wrappedSection: string,
): string {
  const startMarker = `<!-- SECTION:${sectionId} -->`;
  const endMarker = `<!-- /SECTION:${sectionId} -->`;
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return (
      html.slice(0, startIdx) +
      wrappedSection +
      html.slice(endIdx + endMarker.length)
    );
  }
  return insertSection(html, wrappedSection);
}

export function createAppendLandingPageSectionTool(): ToolDefinition {
  return {
    name: "append_landing_page_section",
    label: "Append Landing Page Section",
    description:
      "Append ONE section of HTML to an existing landing page. Use this to assemble a " +
      "full landing page section by section so each tool call stays small (1-3 KB) and " +
      "doesn't get truncated by output token limits.\n\n" +
      "WHEN TO USE THIS vs update_landing_page:\n" +
      "- For a full multi-section site (hero + features + testimonials + pricing + FAQ + CTA + footer), " +
      "always use the sectioned workflow:\n" +
      "    1. Call update_landing_page ONCE with a small SKELETON only — <head>, <body>, " +
      "       inline <style>, navigation, an empty <main><!-- SECTIONS_START --><!-- SECTIONS_END --></main>, " +
      "       footer, and the required <div id=\"capture-form\"></div>. Keep the skeleton under ~3 KB.\n" +
      "    2. Call append_landing_page_section ONCE PER SECTION (hero, features, ...). Each call adds " +
      "       a single self-contained <section>...</section> block.\n" +
      "    3. After all sections are in, call read_landing_page to verify, then save_landing_page.\n" +
      "- For tiny single-section pages or quick rewrites, you can still use update_landing_page directly.\n\n" +
      "INSERTION RULES:\n" +
      "- The section is inserted right before <!-- SECTIONS_END --> if present (recommended), else " +
      "before </main>, else before <div id=\"capture-form\"></div>, else before </body>.\n" +
      "- Pass a stable section_id (e.g. \"hero\", \"features\", \"pricing\") to make the call idempotent — " +
      "if a section with that id already exists, it is REPLACED rather than duplicated. " +
      "This lets you redo a single section without rebuilding the whole page.\n" +
      "- section_html must be self-contained: include any section-scoped <style> inline within the section " +
      "if needed, and reference only classes that exist in the skeleton's global <style>.\n" +
      "- Do NOT include the <div id=\"capture-form\"></div> placeholder inside a section — that lives in the skeleton.",
    parameters: Type.Object({
      landing_page_id: Type.String({
        description: "ID of the landing page to append a section to.",
      }),
      section_html: Type.String({
        description:
          "HTML for a single section (typically a <section>...</section> block). Keep it small " +
          "(under ~3 KB) so the tool call doesn't risk truncation. Inline styles are fine.",
      }),
      section_id: Type.Optional(
        Type.String({
          description:
            "Stable id for this section (e.g. 'hero', 'features', 'pricing'). If omitted, the section " +
            "is appended without a wrapper marker (cannot be replaced later by id). RECOMMENDED.",
        }),
      ),
      run_review: Type.Optional(
        Type.Boolean({
          description:
            "If true, runs a visual review after this section is appended. Default false — skip review " +
            "while still building so you don't pay the render cost for every section. Set true on the " +
            "FINAL section so you get one review pass on the assembled page.",
        }),
      ),
    }),
    execute: async (_id: any, params: any) => {
      const { landing_page_id, section_html, section_id, run_review } = params;

      // The placeholder <div id="capture-form"></div> is fine and often
      // belongs inside a dedicated form/CTA section — the server dedupes
      // duplicates so only the first survives. What's NEVER ok: hand-written
      // <form>, <input>, <textarea>, <select> elements. Those don't wire up
      // to the lead-capture endpoint, so visitors fill them in and nothing
      // happens. The real form is injected by the render pipeline at the
      // placeholder div, with fields configured via update_form_fields.
      const manualFormElement = section_html.match(
        /<(form|input|textarea|select)\b/i,
      );
      if (manualFormElement) {
        return toolError(
          `section_html contains a manual <${manualFormElement[1]}> element. ` +
            "Do NOT hand-write form inputs — they will not capture leads. " +
            'Instead, place exactly one <div id="capture-form"></div> inside the ' +
            "section where you want the form to appear, and configure the actual " +
            "fields with update_form_fields. The render pipeline will inject the " +
            "real, working form into that div.",
        );
      }

      const htmlResult = await internalGet(
        wsPath("landing-page-html", landing_page_id),
      );
      if (isApiError(htmlResult)) return toolText(htmlResult);

      const currentHtml: string = (htmlResult.html as string) ?? "";
      if (!currentHtml) {
        return toolError(
          "Landing page has no HTML yet. Call update_landing_page first to create the skeleton.",
        );
      }

      const wrapped = section_id
        ? `<!-- SECTION:${section_id} -->\n${section_html}\n<!-- /SECTION:${section_id} -->`
        : section_html;

      const nextHtml = section_id
        ? replaceOrAppendSection(currentHtml, section_id, wrapped)
        : insertSection(currentHtml, wrapped);

      if (nextHtml === currentHtml) {
        return toolError(
          "Could not find an insertion point. The skeleton must contain one of: " +
            "<!-- SECTIONS_END -->, </main>, <div id=\"capture-form\"></div>, or </body>.",
        );
      }

      const saveResult = await internalPost(wsPath("landing-page"), {
        id: landing_page_id,
        html: nextHtml,
      });

      if (isApiError(saveResult)) return toolText(saveResult);

      const sectionMatches = nextHtml.match(/<!-- SECTION:[^ ]+ -->/g) || [];
      const sectionIds = sectionMatches
        .map((m) => m.replace("<!-- SECTION:", "").replace(" -->", ""))
        .filter((id) => !id.startsWith("/"));

      let review: { ok: boolean; feedback: string } = { ok: true, feedback: "" };
      if (run_review) {
        try {
          review = await renderAndReviewLandingPage(
            nextHtml,
            `landing page after appending section "${section_id ?? "(unnamed)"}"`,
          );
        } catch {
          // non-fatal
        }
      }

      const reviewBlock = review.ok
        ? {}
        : {
            visualReview: "issues_found",
            reviewFeedback: review.feedback,
            reviewHint:
              "The assembled page has visible problems. Use edit_landing_page or call " +
              "append_landing_page_section again with the same section_id to replace a broken section.",
          };

      return toolText({
        ok: true,
        landing_page_id,
        appended_section_id: section_id ?? null,
        sections_in_page: sectionIds,
        total_html_bytes: nextHtml.length,
        hint:
          "Section appended. Continue with append_landing_page_section for the next section, " +
          "or call read_landing_page to verify and save_landing_page when done. " +
          "Pass run_review:true on the final section to trigger one visual review pass.",
        ...reviewBlock,
      });
    },
  };
}
