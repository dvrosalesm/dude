import { httpError } from "../../http-error.js";
import { insertWorkspaceMessage } from "../../../lib/local-sqlite.js";

/**
 * POST /v1/internal/workspace/:workspaceId/save-messages
 */
export async function saveMessages(
  workspaceId: string,
  body: Record<string, unknown>,
) {
  try {
    const userMsg = body.userMessage as string;
    const assistantMsg = body.assistantMessage as string;
    const isBoot = body.isBootMessage === true;
    const images = Array.isArray(body.images) ? body.images : [];

    if (workspaceId.includes(":")) {
      return { status: "noop" };
    }

    if (userMsg && !isBoot) {
      insertWorkspaceMessage({
        workspaceId,
        role: "user",
        content: userMsg,
      });
    }

    if (!isBoot) {
      for (const imageUrl of images) {
        if (typeof imageUrl === "string" && imageUrl.startsWith("http")) {
          insertWorkspaceMessage({
            workspaceId,
            role: "image",
            content: imageUrl,
          });
        }
      }
    }

    if (assistantMsg) {
      insertWorkspaceMessage({
        workspaceId,
        role: "assistant",
        content: assistantMsg,
      });
    }

    return { status: "saved" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save messages";
    throw httpError(message, 500);
  }
}

/**
 * POST /v1/internal/workspace/:workspaceId/charge-tool
 */
export async function chargeTool(
  _workspaceId: string,
  _body: Record<string, unknown>,
) {
  return { status: "noop", reason: "billing disabled" };
}
