export function normalizeIdentifier(value: string, fallback: string) {
  const base = value.trim();
  const ascii = base.replace(/[^\x00-\x7F]/g, "");
  const normalized = ascii
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  if (!normalized) return fallback;
  if (/^\d/.test(normalized)) return `col_${normalized}`;
  return normalized;
}

export function ensureUniqueIdentifiers(values: string[]) {
  const seen = new Map<string, number>();
  return values.map((value) => {
    const count = seen.get(value) ?? 0;
    seen.set(value, count + 1);
    if (count === 0) return value;
    return `${value}_${count + 1}`;
  });
}

export function inferColumnType(values: string[]) {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  if (cleaned.length === 0) return { type: "text" };
  const isBoolean = cleaned.every((value) =>
    ["true", "false", "0", "1", "yes", "no"].includes(value.toLowerCase()),
  );
  if (isBoolean) return { type: "boolean" };
  const isNumber = cleaned.every((value) => !Number.isNaN(Number(value)));
  if (isNumber) return { type: "number" };
  const isDate = cleaned.every((value) => !Number.isNaN(Date.parse(value)));
  if (isDate) return { type: "date", format: "date-time" };
  return { type: "text" };
}

export function buildTableSchema(
  columns: string[],
  rows: Array<Array<string>>,
) {
  const columnSchemas = columns.map((column, index) => {
    const columnValues = rows.map((row) => String(row[index] ?? ""));
    return {
      name: column,
      ...inferColumnType(columnValues),
    };
  });
  return {
    columns: columnSchemas,
    rowCount: rows.length,
  };
}
