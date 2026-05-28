/**
 * Generate Slide Tool
 *
 * Uses a secondary model (GLM) to generate HTML slide content from a description.
 * The main agent (minimax) orchestrates and calls this tool with prompts,
 * while GLM handles the creative HTML generation.
 *
 * If a design.md document exists, GLM will follow those design guidelines.
 */

import { Type } from "@sinclair/typebox";
import { isNativeRunner } from "@dude/sdk/runner";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { config, internalGet, internalPost, isApiError, openRouterChat, toolError, toolText, wsPath } from "@dude/sdk/gateway-runtime";
import { applyPendingEdits } from "@dude/presentation-editor/document-editor/apply-edits";
import { generateDesignDoc } from "./manage-design.js";
import { renderSlideToImage, reviewSlideScreenshot } from "./slide-preview.js";
import { findRelevantSlides, formatFewShotBlock, orientationFromDimensions } from "./slide-library/index.js";
import { buildSlideSystemPrompt, emuToPixels } from "./slide-authoring-guidelines.js";

const CONTENT_MODEL = "minimax/minimax-m2.7";

/**
 * Extract external URLs from HTML (model-viewer src, iframe src) and HEAD-check them.
 * Returns a list of broken URLs so the agent can search for replacements.
 */
async function findBrokenAssetUrls(html: string): Promise<string[]> {
  const broken: string[] = [];
  // Match model-viewer src="..." and iframe src="..."
  const patterns = [
    /< *model-viewer[^>]+\bsrc\s*=\s*"(https?:\/\/[^"]+)"/gi,
    /< *iframe[^>]+\bsrc\s*=\s*"(https?:\/\/[^"]+)"/gi,
  ];
  const urls = new Set<string>();
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      urls.add(m[1]);
    }
  }
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        const res = await fetch(url, {
          method: "HEAD",
          signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": "AgentsGT/1.0 (asset-check)" },
          redirect: "follow",
        });
        if (!res.ok) {
          broken.push(`${url} (HTTP ${res.status})`);
        }
      } catch (e: any) {
        broken.push(`${url} (${e?.message || "unreachable"})`);
      }
    }),
  );
  return broken;
}

async function generateHtmlContent(prompt: string, designDoc?: string, dims?: { width: number; height: number }, referenceBlock?: string): Promise<string> {
  const content = await openRouterChat({
    model: CONTENT_MODEL,
    messages: [
      { role: "system", content: buildSlideSystemPrompt(designDoc, dims, referenceBlock) },
      { role: "user", content: prompt },
    ],
    maxTokens: 4000,
    temperature: 0.7,
  });

  // Strip markdown code blocks if present
  return content
    .replace(/^```html?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

export function createGenerateSlideTool(): ToolDefinition {
  return {
    name: "generate_slide",
    label: "Generate Slide",
    description:
      "Pi-only: generate HTML slide content via a hosted model. " +
      "Native runners (Codex/Cursor/Hermes) must write HTML and use edit_presentation addHtmlContent instead.",
    parameters: Type.Object({
      slideIndex: Type.Number({
        description: "The slide index to add the content to (0-based)",
      }),
      prompt: Type.String({
        description:
          "Detailed description of the slide content. Include: title, key points, layout preferences, any specific styling.",
      }),
      label: Type.Optional(
        Type.String({
          description: "Optional label for the HTML shape (e.g., 'Debug Mode Slide')",
        }),
      ),
    }),
    execute: async (_id: any, params: any) => {
      const runner = process.env.RUNNER_ID?.trim();
      if (isNativeRunner(runner)) {
        return toolError(
          "generate_slide is not available on this runner. Write HTML yourself and call edit_presentation with addHtmlContent.",
        );
      }

      const { slideIndex, prompt, label } = params;

      if (typeof slideIndex !== "number" || slideIndex < 0) {
        return toolError("Invalid slideIndex");
      }
      if (!prompt || typeof prompt !== "string") {
        return toolError("prompt is required");
      }

      try {
        // Read design doc and slide dimensions from workspace
        let designDoc: string | undefined;
        let slideDimensions: { width: number; height: number } | undefined;
        try {
          const [readResult, contentResult, editsResult] = await Promise.all([
            internalPost(wsPath("read"), {}),
            internalGet(wsPath("collection", "documentContent")),
            internalGet(wsPath("collection", "documentEdits")),
          ]);
          // Back-compat: older workspaces may have a raw markdown string at configurations.designDoc;
          // new ones have { markdown, updatedAt }.
          const storedDesign = (readResult.configurations as Record<string, any> | undefined)?.designDoc;
          designDoc = typeof storedDesign === "string"
            ? storedDesign
            : (storedDesign?.markdown as string | undefined);
          const designUpdatedAt =
            storedDesign && typeof storedDesign === "object"
              ? (storedDesign as { updatedAt?: unknown }).updatedAt
              : undefined;
          if (designDoc) {
            // First non-empty line usually contains the style heading (e.g. "# Brutalist" or
            // "# Editorial — Custom Design System"), which is the clearest signal that the UI
            // persisted the design system correctly before the agent started generating slides.
            const heading = designDoc.split("\n").map((l) => l.trim()).find(Boolean) ?? "(untitled)";
            console.log(
              `[generate_slide] Design system from UI ✓ (${designDoc.length} chars, updatedAt=${designUpdatedAt ?? "n/a"}) — ${heading}`,
            );
          } else {
            // No design doc exists — auto-create one from the user's prompt.
            // NOTE: when multiple generate_slide calls run in parallel (e.g. batched from
            // edit_presentation), each would race to create/save here. The server is idempotent
            // for singleton writes, so last-writer-wins — not ideal but acceptable.
            console.log(`[generate_slide] No design doc found, auto-creating from prompt...`);
            try {
              designDoc = await generateDesignDoc(prompt);
              console.log(`[generate_slide] Auto-created design doc (${designDoc.length} chars)`);
              const saveResult = await internalPost(wsPath("collection"), {
                collection: "designDoc",
                data: { markdown: designDoc },
              });
              if (isApiError(saveResult)) {
                console.warn(`[generate_slide] Failed to persist auto-created design doc: ${saveResult.error}`);
              }
            } catch (designErr) {
              console.warn(`[generate_slide] Failed to auto-create design doc, continuing without: ${designErr}`);
            }
          }

          // Apply pending edits to get current effective dimensions
          const rawContent = (contentResult as any)?.documentContent;
          const rawEdits = (editsResult as any)?.documentEdits;
          const effective = applyPendingEdits(rawContent, rawEdits);
          slideDimensions = effective.slideDimensions;
          if (slideDimensions) {
            console.log(`[generate_slide] Canvas dimensions: ${slideDimensions.width}x${slideDimensions.height} EMU`);
          }
        } catch {
          // No design doc or dimensions, continue with defaults
        }

        // --- Generate → Preview → Review (single retry) ---
        const pxWidth = slideDimensions ? emuToPixels(slideDimensions.width) : 1280;
        const pxHeight = slideDimensions ? emuToPixels(slideDimensions.height) : 720;
        let reviewFeedback = "";

        // Retrieve 2-3 reference slides from the curated library for few-shot inspiration.
        // Orientation is inferred from the effective canvas dimensions when available, so
        // a 9:16 deck gets social-native vertical references and a 16:9 deck gets horizontal.
        let referenceBlock: string | undefined;
        try {
          const orientation = slideDimensions
            ? orientationFromDimensions(slideDimensions.width, slideDimensions.height)
            : undefined;
          const references = await findRelevantSlides(prompt, { k: 3, orientation });
          if (references.length) {
            referenceBlock = formatFewShotBlock(references);
            const ids = references.map((r) => `${r.slide.id}(${r.score.toFixed(1)})`).join(", ");
            const orTag = orientation ? ` [${orientation}]` : "";
            console.log(`[generate_slide] Using ${references.length} reference slides${orTag}: ${ids}`);
          }
        } catch (retrErr) {
          console.warn(`[generate_slide] Reference retrieval failed, continuing without: ${retrErr instanceof Error ? retrErr.message : retrErr}`);
        }

        console.log(`[generate_slide] Generating content for slide ${slideIndex}...`);
        let htmlContent = await generateHtmlContent(prompt, designDoc, slideDimensions, referenceBlock);
        console.log(`[generate_slide] Generated ${htmlContent.length} chars of HTML`);

        // Validate that any 3D model / iframe URLs in the HTML actually exist
        const brokenUrls = await findBrokenAssetUrls(htmlContent);
        if (brokenUrls.length > 0) {
          console.warn(`[generate_slide] Broken asset URLs: ${brokenUrls.join(", ")}`);
          return toolText({
            success: false,
            error: "Generated HTML contains broken asset URLs that returned 404 or are unreachable. " +
              "Search for valid replacement URLs before retrying.",
            brokenUrls,
          });
        }

        // Preview + review (non-fatal if Puppeteer is unavailable)
        try {
          console.log(`[generate_slide] Rendering preview (${pxWidth}x${pxHeight})...`);
          const screenshot = await renderSlideToImage(htmlContent, pxWidth, pxHeight);
          console.log(`[generate_slide] Preview rendered (${Math.round(screenshot.length * 0.75 / 1024)}KB)`);

          const review = await reviewSlideScreenshot(screenshot, prompt);
          if (review.ok) {
            console.log(`[generate_slide] Review passed ✓`);
          } else {
            console.log(`[generate_slide] Review flagged issues: ${review.feedback}`);
            // Single retry with feedback
            const retryPrompt = `${prompt}\n\n## REVISION REQUIRED — Fix these issues:\n${review.feedback}`;
            htmlContent = await generateHtmlContent(retryPrompt, designDoc, slideDimensions, referenceBlock);
            console.log(`[generate_slide] Regenerated ${htmlContent.length} chars of HTML`);
            reviewFeedback = review.feedback;
          }
        } catch (previewErr) {
          console.warn(`[generate_slide] Preview/review skipped: ${previewErr instanceof Error ? previewErr.message : previewErr}`);
        }

        // Save the final HTML via the collection API
        const edit = {
          action: "addHtmlContent",
          slideIndex,
          htmlContent,
          label: label || "Generated Slide",
        };

        const saveResult = await internalPost(wsPath("collection"), {
          collection: "documentEdits",
          data: { edits: [edit] },
        });

        if (isApiError(saveResult)) {
          console.error(`[generate_slide] Failed to save: ${saveResult.error}`);
          return toolText({
            success: false,
            error: `Failed to save generated content: ${saveResult.error}`,
          });
        }

        console.log(`[generate_slide] Saved to workspace ${config.workspaceId}`);

        const result: Record<string, unknown> = {
          success: true,
          slideIndex,
          contentLength: htmlContent.length,
          message: `Generated and saved HTML content for slide ${slideIndex + 1}`,
          // Include the edit so the frontend can apply it in real-time via polling
          _edits: [edit],
        };
        if (reviewFeedback) {
          result.reviewNote = `Visual review flagged issues (auto-corrected): ${reviewFeedback}`;
        }

        return toolText(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[generate_slide] Error: ${message}`);
        return toolText({ success: false, error: message });
      }
    },
  };
}
