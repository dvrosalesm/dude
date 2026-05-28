import { Type } from "@sinclair/typebox";
import { internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { toolText, wsPath } from "@dude/sdk/gateway-runtime";

export function createUpdateFormFieldsTool(): ToolDefinition {
  return {
    name: "update_form_fields",
    label: "Update Form Fields",
    description:
      "Configure which information fields the landing page form should collect from visitors. " +
      "Each field has a name (machine key), label (human-readable), type, and whether it's required. " +
      "Supported field types: text, email, tel, number, textarea, select. " +
      "For select fields, include an options array. " +
      "Replaces the page's full fields list — pass every field you want, not just the changes.",
    parameters: Type.Object({
      landing_page_id: Type.String({
        description: "ID of the landing page to configure fields for",
      }),
      fields: Type.Array(
        Type.Object({
          name: Type.String({
            description:
              "Machine-readable field name (e.g. 'email', 'full_name')",
          }),
          label: Type.String({
            description: "Human-readable label for the field",
          }),
          type: Type.Union(
            [
              Type.Literal("text"),
              Type.Literal("email"),
              Type.Literal("tel"),
              Type.Literal("number"),
              Type.Literal("textarea"),
              Type.Literal("select"),
            ],
            { description: "Input type" },
          ),
          placeholder: Type.Optional(
            Type.String({ description: "Placeholder text" }),
          ),
          required: Type.Boolean({
            description: "Whether the field is required",
          }),
          options: Type.Optional(
            Type.Array(Type.String(), {
              description: "Options for select fields",
            }),
          ),
        }),
        { description: "Array of form field configurations" },
      ),
    }),
    execute: async (_id: any, params: any) => {
      return toolText(
        await internalPost(wsPath("landing-page-fields"), params),
      );
    },
  };
}
