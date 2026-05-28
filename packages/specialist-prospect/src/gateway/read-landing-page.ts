import { Type } from "@sinclair/typebox";
import { internalGet } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { isApiError, toolText, wsPath } from "@dude/sdk/gateway-runtime";

export function createReadLandingPageTool(): ToolDefinition {
  return {
    name: "read_landing_page",
    label: "Read Landing Page",
    description:
      "Read the current HTML source of a landing page with line numbers. " +
      "Use this BEFORE edit_landing_page so you can see the exact line numbers " +
      "to target your edits. Returns each line prefixed with its line number.",
    parameters: Type.Object({
      landing_page_id: Type.String({
        description: "ID of the landing page to read",
      }),
    }),
    execute: async (_id: any, params: any) => {
      const result = await internalGet(
        wsPath("landing-page-html", params.landing_page_id),
      );
      if (isApiError(result)) return toolText(result);
      // Add line numbers like cat -n
      const html = (result.html as string) || "";
      const lines = html.split("\n");
      const numbered = lines
        .map((line: string, i: number) => `${i + 1}\t${line}`)
        .join("\n");
      return {
        content: [
          { type: "text", text: `${lines.length} lines total\n\n${numbered}` },
        ],
        details: {},
      };
    },
  };
}
