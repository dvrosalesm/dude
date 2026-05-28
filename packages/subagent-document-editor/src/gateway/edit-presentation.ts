import { Type } from "@sinclair/typebox";
import { config } from "@dude/sdk/gateway-runtime";
import { internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { isApiError, toolError, toolText, wsPath } from "@dude/sdk/gateway-runtime";

/** HEAD-check an image URL to verify it's reachable and returns an image content-type. */
async function verifyImageUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "AgentsGT/1.0 (image-check)" },
      redirect: "follow",
    });
    if (!res.ok) return `HTTP ${res.status} — URL is not accessible`;
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return `URL returned ${ct || "unknown"} instead of an image`;
    return null; // ok
  } catch (e: any) {
    return e?.message || "Failed to reach URL";
  }
}

export function createEditPresentationTool(): ToolDefinition {
  return {
    name: "edit_presentation",
    label: "Edit Presentation",
    description:
      "Save slide edits to the presentation. YOU write HTML in the agent — this tool only persists changes. " +
      "To ADD a slide: insertSlide with afterSlideIndex=last index, then addHtmlContent on the new index — never deleteSlide unless the user asked to remove slides. " +
      "To EDIT a slide: addHtmlContent on that slideIndex only. " +
      "Make SMALL incremental calls — ideally one slide per call. " +
      "Available actions: insertSlide, deleteSlide, deleteSlides (batch), reorderSlide, updateSlide, formatText, " +
      "replaceText, setSlideBackground, resizeSlides, addTable, addImage, " +
      "addChart, addHtmlContent, setSlideTransition, clearChanges.",
    parameters: Type.Object({
      edits: Type.Array(
        Type.Object(
          {
            action: Type.String({
              description:
                "Action type (e.g. insertSlide, deleteSlide, setSlideBackground)",
            }),
          },
          { additionalProperties: true },
        ),
        { description: "Array of edit actions to apply in order" },
      ),
    }),
    execute: async (_id: any, params: any) => {
      const edits = params.edits;
      if (!Array.isArray(edits)) return toolError("edits must be an array");
      const valid = edits.filter(
        (e: any) => e && typeof e.action === "string",
      );

      // Validate image URLs before accepting addImage edits
      const badImages: string[] = [];
      const accepted: any[] = [];
      for (const edit of valid) {
        if (edit.action === "addImage" && typeof edit.imageUrl === "string") {
          const err = await verifyImageUrl(edit.imageUrl);
          if (err) {
            badImages.push(`addImage(${edit.imageUrl}): ${err}`);
            continue; // drop this edit
          }
        }
        if (edit.action === "addHtmlContent") {
          const html =
            typeof edit.htmlContent === "string" ? edit.htmlContent.trim() : "";
          if (!html) continue;
        }
        accepted.push(edit);
      }

      if (badImages.length && accepted.length === 0) {
        return toolText({
          success: false,
          error: "All image URLs failed validation. Find different image URLs and try again.",
          failedImages: badImages,
        });
      }

      // Save edits to the workspace DB so they persist even if the frontend disconnects.
      // internalPost never throws — it returns { error: "..." } on failure.
      const saveResult = await internalPost(wsPath("collection"), {
        collection: "documentEdits",
        data: { edits: accepted },
      });

      if (isApiError(saveResult)) {
        console.error(`[edit_presentation] Failed to save edits: ${saveResult.error}`);
        return toolText({
          success: false,
          error: `Failed to persist edits: ${saveResult.error}. Please try again.`,
          editCount: accepted.length,
        });
      }

      console.log(`[edit_presentation] Saved ${accepted.length} edits to workspace ${config.workspaceId}`);

      const result: Record<string, any> = {
        success: true,
        editCount: accepted.length,
        accepted: accepted.length,
        rejected: edits.length - accepted.length,
      };
      if (badImages.length) {
        result.failedImages = badImages;
        result.warning = "Some image URLs were broken and were skipped. Use different URLs for those images.";
      }

      return toolText(result);
    },
  };
}
