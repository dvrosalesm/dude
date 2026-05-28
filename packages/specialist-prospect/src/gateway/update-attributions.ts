import { Type } from "@sinclair/typebox";
import { internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { toolText, wsPath } from "@dude/sdk/gateway-runtime";

export function createUpdateAttributionsTool(): ToolDefinition {
  return {
    name: "update_attributions",
    label: "Update Attributions",
    description:
      "Set the attributions text for a landing page. The text is served at " +
      "/capture/{landing_page_id}/attributions.txt and a small 'Attributions' " +
      "link is auto-injected into the page footer so visitors can find it. " +
      "Call this after every update_landing_page / edit_landing_page that " +
      "introduces or removes imagery — pass the credit lines for any AnyAsset " +
      "results whose license requires attribution (Noun Project, some " +
      "Openverse / Creative Commons sources). When the page uses no " +
      "third-party assets requiring attribution, pass text='No third-party " +
      "assets requiring attribution were used on this page.' so the file " +
      "still exists and is consistent across every page.",
    parameters: Type.Object({
      landing_page_id: Type.String({
        description: "ID of the landing page",
      }),
      text: Type.String({
        description:
          "Plain-text attributions to publish at /capture/{id}/attributions.txt. " +
          "Format freely — typically one credit per line, e.g. " +
          "'Hero photo by Jane Doe via Unsplash (https://unsplash.com/...)'. " +
          "Use 'No third-party assets requiring attribution were used on this page.' " +
          "for pages with no attributable assets.",
      }),
    }),
    execute: async (_id: any, params: any) => {
      return toolText(
        await internalPost(wsPath("landing-page-attributions"), params),
      );
    },
  };
}
