import { Type } from "@sinclair/typebox";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { toolError, toolText, wsPath } from "@dude/sdk/gateway-runtime";

const PAGES_DIR = "/app/landing-pages";

export function createSaveLandingPageTool(): ToolDefinition {
  return {
    name: "save_landing_page",
    label: "Save Landing Page",
    description:
      "Upload the local landing page HTML file to storage so changes are visible in the preview. " +
      "Call this after editing the local file (at /app/landing-pages/{page_id}.html) " +
      "using file tools or bash.",
    parameters: Type.Object({
      landing_page_id: Type.String({
        description: "ID of the landing page to save",
      }),
    }),
    execute: async (_id: any, params: any) => {
      const pageId = params.landing_page_id;
      const filePath = join(PAGES_DIR, `${pageId}.html`);

      let html: string;
      try {
        html = await readFile(filePath, "utf-8");
      } catch {
        return toolError(
          `File not found: ${filePath}. Create the page first with update_landing_page.`,
        );
      }

      // Upload to R2 via internal API (reuses the landing-page endpoint)
      return toolText(
        await internalPost(wsPath("landing-page"), { id: pageId, html }),
      );
    },
  };
}
