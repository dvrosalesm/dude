/**
 * Generate Image tool — design-branding canvas variant (persist via workspace_save).
 */

import type { ToolDefinition } from "@dude/sdk/gateway";
import { createGenerateImageTool as createSharedGenerateImageTool } from "@dude/sdk/gateway-runtime";

export function createGenerateImageTool(): ToolDefinition {
  return createSharedGenerateImageTool({ audience: "design-branding" });
}
