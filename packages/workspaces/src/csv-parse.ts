export function parseCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

export function parseCsv(
  text: string,
  options: { delimiter?: string; hasHeaderRow?: boolean } = {},
) {
  const delimiter = options.delimiter || ",";
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [] as string[], rows: [] as string[][] };
  }

  const parsedRows = lines.map((line) => parseCsvLine(line, delimiter));
  const width = Math.max(...parsedRows.map((row) => row.length));
  const firstRowIsHeader = options.hasHeaderRow !== false;
  const headers = firstRowIsHeader
    ? parsedRows[0].map((header, index) => header.trim() || `column_${index + 1}`)
    : Array.from({ length: width }, (_, index) => `column_${index + 1}`);
  const rows = firstRowIsHeader ? parsedRows.slice(1) : parsedRows;
  return { headers, rows };
}
