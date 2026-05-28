/** Turn markdown lists into plain centered lines (no ul/li AST). */
export function flattenStageMarkdown(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const result: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const bullet = line.match(
      /^(\s*)([-*+•·‣▪–—]|\u2022)\s+(.*)$/,
    );
    const ordered = line.match(/^(\s*)\d+[.)]\s+(.*)$/);

    if (bullet) {
      if (result.length > 0 && result[result.length - 1] !== "") {
        result.push("");
      }
      result.push(bullet[3]);
      continue;
    }

    if (ordered) {
      if (result.length > 0 && result[result.length - 1] !== "") {
        result.push("");
      }
      result.push(ordered[2]);
      continue;
    }

    result.push(line);
  }

  return result.join("\n");
}
