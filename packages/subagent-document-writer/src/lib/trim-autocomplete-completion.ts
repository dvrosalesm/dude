const MAX_COMPLETION_CHARS = 240;

export function trimAutocompleteCompletion(raw: string, prefix: string): string {
  let text = raw.trim();
  if (!text) return "";

  text = text
    .replace(/^```[\w]*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }

  if (text.toLowerCase().startsWith(prefix.toLowerCase().slice(-40))) {
    text = text.slice(prefix.length).trimStart();
  }

  if (text.length > MAX_COMPLETION_CHARS) {
    const cut = text.slice(0, MAX_COMPLETION_CHARS);
    const lastSpace = cut.lastIndexOf(" ");
    text = lastSpace > 40 ? cut.slice(0, lastSpace) : cut;
  }

  return text.replace(/\s+/g, " ").trim();
}
