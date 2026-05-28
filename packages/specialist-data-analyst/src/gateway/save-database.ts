import { Type } from "@sinclair/typebox";
import { config } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { toolText } from "@dude/sdk/gateway-runtime";

/** Deprecated — writes go directly to ~/.dude/dude-local.sqlite. Kept for agent compatibility. */
export function createSaveDatabaseTool(): ToolDefinition {
  return {
    name: "save_database",
    label: "Save Database",
    description:
      "No-op in local mode — database changes persist immediately to ~/.dude/dude-local.sqlite.",
    parameters: Type.Object({}),
    execute: async () => {
      if (!config.workspaceId) {
        return toolText({ status: "noop", reason: "No workspace ID configured" });
      }
      return toolText({
        status: "saved",
        message: "Changes are already persisted in the local database.",
      });
    },
  };
}
