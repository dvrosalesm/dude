/**
 * read-specialist-artifact tool — reads a collection (or full config) from
 * any workspace by ID, not just the caller's own workspace.
 *
 * Used to hand off artifacts between subagents in a GT project session:
 * the main assistant remembers which workspace belongs to which subagent
 * (in its `gtSession` collection), and downstream subagents can pull
 * upstream artifacts (brand guide, analysis results, slide deck, landing
 * page metadata) by workspace ID without forcing the GT to forward
 * everything via the `context` string.
 */

import { Type } from "@sinclair/typebox";
import { internalGet } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "../types.js";
import { toolError, toolText } from "./_shared.js";

export function createReadSubagentArtifactTool(): ToolDefinition {
  return {
    name: "read_subagent_artifact",
    label: "Read Subagent Artifact",
    description:
      "Read artifacts from another subagent's workspace by ID. " +
      "Use this when chaining subagents and a downstream task needs " +
      "outputs produced by an upstream one (e.g. presentation reads brand " +
      "guide from design-branding workspace, marketing reads analysis from " +
      "data-analyst workspace).\n\n" +
      "The workspaceId comes from the GT main assistant's `gtSession` or " +
      "from the `context` argument passed when this subagent was invoked. " +
      "Provide a `collection` to read just one slice (cheaper) or omit it " +
      "to read the whole workspace config.\n\n" +
      "Common collection names: brandBook, palettes, typography, logos, " +
      "canvasSnapshot (design-branding) · landingPages, leads (prospect) " +
      "· documentEdits, designDoc (document-editor).",
    parameters: Type.Object({
      workspaceId: Type.String({
        description:
          "The workspace ID to read from. Must come from the GT session map " +
          "or the context provided to this subagent call — do not invent IDs.",
      }),
      collection: Type.Optional(
        Type.String({
          description:
            "Optional collection name (e.g. 'brandBook', 'palettes', " +
            "'researchRuns'). Omit to read the entire workspace config.",
        }),
      ),
    }),
    execute: async (_toolCallId, params) => {
      const workspaceId = String(params?.workspaceId || "").trim();
      if (!workspaceId) return toolError("workspaceId is required");

      const collection = params?.collection
        ? String(params.collection).trim()
        : "";
      const path = collection
        ? `/workspace/${encodeURIComponent(workspaceId)}/collection/${encodeURIComponent(collection)}`
        : `/workspace/${encodeURIComponent(workspaceId)}/config`;

      const details = { workspaceId, collection: collection || null };
      try {
        return toolText(await internalGet(path), details);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return toolError(`Failed to read artifact: ${message}`, details);
      }
    },
  };
}
