/**
 * Shared generate_image tool — Gemini image engine via internal subagent-run.
 */

import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "../types.js";
import { config } from "./config.js";
import { internalPost } from "./internal-api.js";
import { toolError, toolText } from "./shared.js";

export type GenerateImageAudience = "main-assistant" | "design-branding";

export function createGenerateImageTool(options?: {
  audience?: GenerateImageAudience;
}): ToolDefinition {
  const forMain = options?.audience === "main-assistant";

  return {
    name: "generate_image",
    label: "Generate Image",
    description: forMain
      ? "Generate an image (logo, illustration, mock visual) via the shared Gemini image engine. " +
        "Returns an image URL that appears in the chat for the user. Use this yourself for quick visuals — " +
        "do NOT delegate simple image requests to design-branding. " +
        "Delegate to design-branding only for brand systems, canvas work, palettes, typography, and multi-asset brand books."
      : "Generate a logo, mood image, or other visual via the shared image engine (Gemini). " +
        "Returns an image URL. After calling this, persist the result on the canvas via `workspace_save` — " +
        "e.g. a `logoConcept` node containing { name, brief, imageUrl, rationale }, or an `image` " +
        "node with { url }. Never expose the URL as raw chat text.",
    parameters: Type.Object({
      prompt: Type.String({
        description:
          "Concrete, self-contained image brief. Include subject, style, " +
          "color direction, and any constraints (e.g. 'flat vector logo, " +
          "two-tone teal & cream, geometric mark of a folded leaf, no text').",
      }),
      aspectRatio: Type.Optional(
        Type.String({
          description:
            "Aspect ratio hint, e.g. '1:1' (logos), '16:9', '4:5'. Defaults to '1:1'.",
        }),
      ),
    }),
    execute: async (_toolCallId, params) => {
      const prompt = String(params?.prompt || "").trim();
      const aspectRatio = params?.aspectRatio
        ? String(params.aspectRatio)
        : "1:1";
      const scopeId = config.workspaceId;
      if (!prompt) return toolError("prompt is required");
      if (!scopeId) return toolError("workspace context is missing in the gateway");

      const result = await internalPost("/assistant/subagent-run", {
        subagentId: "image-studio",
        orgId: scopeId,
        message: `${prompt}\n\nAspect ratio: ${aspectRatio}.`,
      });

      const imageUrl =
        typeof result.imageUrl === "string" ? (result.imageUrl as string) : null;

      if (!imageUrl) {
        const error =
          typeof result.error === "string"
            ? (result.error as string)
            : "Image generation failed.";
        return toolError(error);
      }

      return toolText({ imageUrl, prompt, aspectRatio }, { imageUrl });
    },
  };
}
