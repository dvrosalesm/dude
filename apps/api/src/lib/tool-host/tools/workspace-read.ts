import { Type } from "@sinclair/typebox";
import { internalGet } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "../types.js";
import { toolText, wsPath } from "./_shared.js";

export function createWorkspaceReadTool(): ToolDefinition {
  return {
    name: "workspace_read",
    label: "Read Workspace",
    description:
      "Read data from the workspace database. Optionally specify a collection " +
      "name to read just that collection, or omit it to read all workspace data.\n\n" +
      "This reads from the DATABASE, not from the internet. " +
      "Use web_search if you need to search the internet.",
    parameters: Type.Object({
      collection: Type.Optional(
        Type.String({
          description:
            "Optional collection name to read (e.g. 'campaigns', 'plans', 'researchRuns'). " +
            "Omit to read all workspace data.",
        }),
      ),
    }),
    execute: async (_toolCallId, params) => {
      const path = params.collection
        ? wsPath("collection", encodeURIComponent(params.collection))
        : wsPath("config");
      return toolText(await internalGet(path));
    },
  };
}
