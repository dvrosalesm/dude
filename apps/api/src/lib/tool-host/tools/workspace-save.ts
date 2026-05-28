import { Type } from "@sinclair/typebox";
import { config } from "@dude/sdk/gateway-runtime";
import { internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "../types.js";
import { isApiError, toolError, toolText, wsPath } from "./_shared.js";

export function createWorkspaceSaveTool(): ToolDefinition {
  return {
    name: "workspace_save",
    label: "Save to Workspace",
    description:
      "Save, update, or delete data in the workspace database. " +
      "Specify the collection name and the data object.\n\n" +
      "For array collections (campaigns, plans, researchRuns, landingPages, leads):\n" +
      "  - Default mode 'upsert': include an 'id' to update an existing item, or omit it to create a new one.\n" +
      "  - Mode 'delete': pass {id} and mode='delete' to remove an item by id (use this to fix duplicates — never 'tag' a row as deleted).\n\n" +
      "For singleton collections (brandResearch, icp): the data replaces the entire value. Delete mode is not supported on singletons.\n\n" +
      "The system prompt tells you which collections are available and their expected fields. " +
      "This tool writes to the database — it does NOT search the internet.",
    parameters: Type.Object({
      collection: Type.String({
        description:
          "Collection name to write to (e.g. 'researchRuns', 'campaigns', 'plans', 'brandResearch', 'landingPages', 'leads')",
      }),
      data: Type.Record(Type.String(), Type.Unknown(), {
        description:
          "The data object to save. For array collections, include 'id' to update an existing item. For mode='delete', only 'id' is required.",
      }),
      mode: Type.Optional(
        Type.Union([Type.Literal("upsert"), Type.Literal("delete")], {
          description:
            "Defaults to 'upsert'. Use 'delete' to remove an array item by data.id — preferred over writing a 'this is a duplicate' note.",
        }),
      ),
    }),
    execute: async (_toolCallId, params) => {
      // LLMs sometimes pass data as a JSON string instead of an object — parse it
      let data = params.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          console.error(`[workspace_save] Failed to parse data string`);
          return toolError("data must be a JSON object, not a string");
        }
      }

      const mode = params.mode === "delete" ? "delete" : "upsert";
      console.log(
        `[workspace_save] ${mode === "delete" ? "Deleting from" : "Saving to"} ${params.collection} in workspace ${config.workspaceId}`,
      );
      const result = await internalPost(wsPath("collection"), {
        collection: params.collection,
        data,
        mode,
      });
      if (isApiError(result)) {
        console.error(`[workspace_save] Failed:`, result.error);
      } else {
        console.log(
          `[workspace_save] ${mode === "delete" ? "Deleted" : "Saved"} ${params.collection}: ${result.id ?? "ok"}`,
        );
      }
      return toolText(result);
    },
  };
}
