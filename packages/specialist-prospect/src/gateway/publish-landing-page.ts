import { Type } from "@sinclair/typebox";
import { internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { toolText, wsPath } from "@dude/sdk/gateway-runtime";

export function createPublishLandingPageTool(): ToolDefinition {
  return {
    name: "publish_landing_page",
    label: "Publish Landing Page",
    description:
      "Publish or unpublish a landing page. When published, the page is accessible " +
      "at the public capture URL. When unpublished, it returns a 404.",
    parameters: Type.Object({
      landing_page_id: Type.String({
        description: "ID of the landing page",
      }),
      published: Type.Boolean({
        description: "Whether the page should be published",
      }),
    }),
    execute: async (_id: any, params: any) => {
      return toolText(
        await internalPost(wsPath("landing-page-publish"), params),
      );
    },
  };
}
