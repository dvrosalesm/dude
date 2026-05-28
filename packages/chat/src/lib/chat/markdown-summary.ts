/** Strip boilerplate when rich visuals already carry the answer. */
export function formatDreamSummary(content: string): string {
  let text = content.trim();
  text = text.replace(
    /^Here(?:'s| is) the (?:generated )?image you requested\.?\s*/i,
    "",
  );
  return text.trim() || content.trim();
}

export function shouldShowDreamSummary(content: string, hasImages: boolean): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  if (!hasImages) return true;

  const cleaned = formatDreamSummary(trimmed);
  if (!cleaned) return false;
  if (
    /^Here(?:'s| is) the (?:generated )?image you requested\.?$/i.test(
      cleaned,
    )
  ) {
    return false;
  }
  return true;
}
