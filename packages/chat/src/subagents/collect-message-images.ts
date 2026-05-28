import {
  collectImageUrlsFromToolExecutions,
  isDisplayableImageUrl,
  mergeImageUrlLists,
} from "@dude/gateway-shared/generated-image-urls";
import type { SubagentMessage } from "./types";

export function collectGeneratedImageUrls(message: SubagentMessage): string[] {
  const fromImages = Array.isArray(message.images)
    ? message.images.filter(isDisplayableImageUrl)
    : [];
  const fromRole =
    message.role === "image" && isDisplayableImageUrl(message.message)
      ? [message.message]
      : [];
  const fromTrace = collectImageUrlsFromToolExecutions(
    message.executionTrace?.toolExecutions,
  );
  return mergeImageUrlLists(fromImages, fromRole, fromTrace) ?? [];
}
