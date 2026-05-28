/**
 * Memory tools — allow the main assistant to read and write
 * organization memories so preferences and context persist.
 */

import { Type } from "@sinclair/typebox";
import { internalGet, internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "../types.js";
import { getOrgUser, toolError, toolText } from "./_shared.js";

export function createSaveMemoryTool(): ToolDefinition {
  return {
    name: "save-memory",
    label: "Save Memory",
    description:
      "Save information to the organization's long-term memory. " +
      "Use this when the user asks you to remember something, or when you learn " +
      "important preferences, context, or facts that should persist across conversations.",
    parameters: Type.Object({
      title: Type.String({
        description: "Short title (e.g. 'Favorite color', 'Brand guidelines').",
      }),
      content: Type.String({
        description: "The information to remember. MUST be under 200 characters. Write it as a single concise fact, not a paragraph.",
      }),
      scope: Type.Optional(
        Type.String({
          description: "'organization' for shared context, 'user' for personal preferences. Defaults to 'organization'.",
        }),
      ),
      tags: Type.Optional(
        Type.Array(Type.String(), {
          description: "Optional tags (e.g. ['preferences', 'design']).",
        }),
      ),
    }),
    execute: async (_toolCallId, params) => {
      const title = String(params?.title || "").slice(0, 80);
      const content = String(params?.content || "").slice(0, 200);
      if (!title || !content) {
        return toolError("title and content are required");
      }

      const { orgId, userId } = getOrgUser();
      const scope = params?.scope === "user" ? "user" : "organization";

      return toolText(
        await internalPost("/assistant/memories", {
          orgId,
          title,
          content,
          scope,
          userId,
          tags: Array.isArray(params?.tags) ? params.tags : [],
        }),
      );
    },
  };
}

export function createListMemoriesTool(): ToolDefinition {
  return {
    name: "list-memories",
    label: "List Memories",
    description:
      "Retrieve saved memories. Use this to check what has been remembered, " +
      "or to find context about user preferences and past decisions.",
    parameters: Type.Object({
      query: Type.Optional(
        Type.String({ description: "Optional search query to filter memories." }),
      ),
    }),
    execute: async (_toolCallId, _params) => {
      const { orgId, userId } = getOrgUser();
      let path = `/assistant/memories?orgId=${encodeURIComponent(orgId)}`;
      if (userId) path += `&userId=${encodeURIComponent(userId)}`;
      return toolText(await internalGet(path));
    },
  };
}
