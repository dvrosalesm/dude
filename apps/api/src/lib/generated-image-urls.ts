import { collectImageUrlsFromToolExecutions } from "@dude/gateway-shared/generated-image-urls";
import type { ConversationMessage } from "./instances/conversation-message.js";

export function collectImageUrlsFromTraces(
  traces: ConversationMessage["traces"],
): string[] {
  return collectImageUrlsFromToolExecutions(traces?.toolExecutions);
}
