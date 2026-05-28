import type { SpecialistDeclaration } from "@dude/sdk/gateway";
import { createGenerateImageTool } from "./generate-image.js";
import { createExtractImageColorsTool } from "./extract-image-colors.js";

/**
 * Design & Branding specialist — visual brand builder on a Miro-like canvas.
 *
 * Persists artifacts (brand book sections, palettes, typography, logo concepts,
 * design reviews, tokens exports, canvas snapshot) via standard
 * workspace_save / workspace_read. Generates logos and mood images via the
 * shared image engine (Gemini "nano banana") through the `generate_image` tool.
 */
export const declaration: SpecialistDeclaration = {
  baseTools: [
    "web_search",
    "web_scrape",
    "search_in_website",
    "workspace_read",
    "workspace_save",
    "read_specialist_artifact",
    "save_memory",
    "list_memories",
  ],
  customTools: [createGenerateImageTool, createExtractImageColorsTool],
  collections: [
    "brandBook",
    "palettes",
    "typography",
    "logos",
    "reviews",
    "tokensExports",
    "canvasSnapshot",
  ],
};
