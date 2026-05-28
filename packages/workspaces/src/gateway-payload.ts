import type { SendLocalMessageInput, SubagentId } from "@dude/client-types";
import {
  extractUserFacingMessage,
  USER_MESSAGE_MARKER,
} from "@dude/gateway-shared/user-facing-message";

export { extractUserFacingMessage, USER_MESSAGE_MARKER };

const METADATA_KEYS = new Set([
  "message",
  "prompt",
  "history",
  "messageImages",
  "attachedImageUrls",
  "gatewaySessionId",
  "_bootMessage",
]);

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function extractMessage(body: Record<string, unknown>) {
  if (typeof body.message === "string") return body.message;
  if (typeof body.prompt === "string") return body.prompt;
  return "";
}

function extractImages(body: Record<string, unknown>) {
  const fromMessage = Array.isArray(body.messageImages)
    ? body.messageImages.filter(isString)
    : [];
  const fromAttached = Array.isArray(body.attachedImageUrls)
    ? body.attachedImageUrls.filter(isString)
    : [];
  const images = [...new Set([...fromMessage, ...fromAttached])];
  return images.length ? images : undefined;
}

function extractHistory(body: Record<string, unknown>) {
  if (!Array.isArray(body.history)) return undefined;
  const history = body.history
    .filter(
      (entry): entry is { role: string; content: string } =>
        Boolean(entry) &&
        typeof entry === "object" &&
        typeof (entry as { role?: unknown }).role === "string" &&
        typeof (entry as { content?: unknown }).content === "string",
    )
    .map(({ role, content }) => ({ role, content }));
  return history.length ? history : undefined;
}

function formatContextBlock(context: Record<string, unknown>) {
  const blocks: string[] = [];

  if (typeof context.documentContext === "string" && context.documentContext.trim()) {
    blocks.push(context.documentContext.trim());
  }

  const schema = context.schema ?? context.dataSchema;
  if (typeof schema === "string" && schema.trim()) {
    blocks.push(`--- DATA SCHEMA ---\n${schema.trim()}\n--- END DATA SCHEMA ---`);
  } else if (schema && typeof schema === "object") {
    blocks.push(
      `--- DATA SCHEMA ---\n${JSON.stringify(schema, null, 2)}\n--- END DATA SCHEMA ---`,
    );
  }

  const tableContext = context.tableContext ?? context.tables;
  if (typeof tableContext === "string" && tableContext.trim()) {
    blocks.push(tableContext.trim());
  }

  const handled = new Set([
    "documentContext",
    "description",
    "template",
    "contextDocuments",
    "schema",
    "dataSchema",
    "tableContext",
    "tables",
    "presentationName",
    "slideCount",
    "referenceName",
    "referenceText",
    "selectedSlideIndices",
    "slideDimensions",
    "designStyle",
    "fontPair",
  ]);

  for (const [key, value] of Object.entries(context)) {
    if (handled.has(key) || value == null || value === "") continue;
    if (typeof value === "string") {
      blocks.push(`--- ${key.toUpperCase()} ---\n${value}\n--- END ${key.toUpperCase()} ---`);
    } else if (typeof value === "object") {
      blocks.push(
        `--- ${key.toUpperCase()} ---\n${JSON.stringify(value, null, 2)}\n--- END ${key.toUpperCase()} ---`,
      );
    }
  }

  return blocks.join("\n\n");
}

export function buildSendMessageInput(
  subagentId: SubagentId,
  workspaceId: string,
  body: Record<string, unknown>,
): SendLocalMessageInput {
  const message = extractMessage(body);
  const contextEntries = Object.fromEntries(
    Object.entries(body).filter(([key]) => !METADATA_KEYS.has(key)),
  );
  const contextBlock = formatContextBlock(contextEntries);
  const content = contextBlock
    ? `${contextBlock}${USER_MESSAGE_MARKER}${message}`
    : message;

  return {
    subagentId,
    workspaceId,
    content,
    displayContent: message,
    history: extractHistory(body),
    images: extractImages(body),
    gatewaySessionId:
      typeof body.gatewaySessionId === "string" ? body.gatewaySessionId : undefined,
  };
}
