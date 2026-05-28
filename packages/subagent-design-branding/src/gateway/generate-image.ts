/**
 * Generate Image tool — produces logos, mood images, and other visual
 * artifacts via Gemini ("nano banana") so the design-branding agent can
 * place them on the canvas. Returns the uploaded image URL; the agent is
 * expected to persist it via `workspace_save` (e.g. as a `logoConcept` node).
 *
 * Internally still routed via the gateway's subagent-run path with the
 * legacy "image-studio" key — that key now just maps to the shared image
 * generation endpoint at /api/internal/image-generation.
 */

import { Type } from "@sinclair/typebox";
import { config } from "@dude/sdk/gateway-runtime";
import { internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { toolError, toolText } from "@dude/sdk/gateway-runtime";

export function createGenerateImageTool(): ToolDefinition {
  return {
    name: "generate_image",
    label: "Generate Image",
    description:
      "Generate a logo, mood image, or other visual via the shared image " +
      "engine (Gemini). Returns an image URL. After calling this, persist " +
      "the result on the canvas via `workspace_save` — e.g. a `logoConcept` " +
      "node containing { name, brief, imageUrl, rationale }, or an `image` " +
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
