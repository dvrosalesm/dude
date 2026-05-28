/**
 * Extract displayable image URLs from tool results and chat traces.
 */

const IMAGE_TOOL_NAMES = new Set([
  "generate_image",
  "image_gen",
  "imagegen",
  "generateImage",
]);

export function isDisplayableImageUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  );
}

export function extractImageUrlFromUnknown(result: unknown): string | null {
  if (!result) return null;
  let obj = result;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      const trimmed = obj.trim();
      if (isDisplayableImageUrl(trimmed)) return trimmed;
      return null;
    }
  }
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return null;
    }
  }
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const record = obj as Record<string, unknown>;
    const direct =
      typeof record.imageUrl === "string"
        ? record.imageUrl
        : typeof record.url === "string"
          ? record.url
          : typeof record.src === "string"
            ? record.src
            : null;
    if (direct && isDisplayableImageUrl(direct)) return direct;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const nested = extractImageUrlFromUnknown(item);
      if (nested) return nested;
    }
  }
  return null;
}

export function collectImageUrlsFromToolExecutions(
  executions: Array<{ tool: string; result: unknown }> | undefined,
): string[] {
  if (!executions?.length) return [];
  const urls: string[] = [];
  for (const exec of executions) {
    const url = extractImageUrlFromUnknown(exec.result);
    if (url) urls.push(url);
    else if (IMAGE_TOOL_NAMES.has(exec.tool)) {
      const http = String(exec.result ?? "").match(
        /https?:\/\/[^\s"'<>]+/,
      )?.[0];
      if (http && isDisplayableImageUrl(http)) urls.push(http);
    }
  }
  return [...new Set(urls)];
}

export function mergeImageUrlLists(
  ...lists: Array<string[] | undefined>
): string[] | undefined {
  const merged = [
    ...new Set(lists.flatMap((list) => list ?? []).filter(isDisplayableImageUrl)),
  ];
  return merged.length > 0 ? merged : undefined;
}
