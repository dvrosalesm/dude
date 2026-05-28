/**
 * Shared utilities extracted from the data-analyst page.tsx.
 */

/** Try to extract a JSON object from an AI response string. */
export function extractJsonSnippet(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // ignore
  }
  const fenceMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenceMatch ? fenceMatch[1] : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

/** Sanitize a Vega-Lite spec by stripping disallowed remote URLs. */
export function sanitizeVegaLiteSpec(
  input: unknown,
): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  let next: Record<string, unknown>;
  try {
    next = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
  } catch {
    return null;
  }

  const allowedUrlPrefixes = [
    "https://cdn.jsdelivr.net/npm/world-atlas@2/",
    "https://cdn.jsdelivr.net/npm/vega-datasets@2/",
    "https://github.com/wmgeolab/geoBoundaries/raw/",
  ];

  function stripRemoteUrls(node: unknown): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) stripRemoteUrls(item);
      return;
    }
    const record = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (key === "url" && typeof value === "string") {
        const url = value.trim();
        if (/^javascript:/i.test(url)) {
          delete record[key];
          continue;
        }
        const isRemote = /^(https?:|data:)/i.test(url);
        if (
          isRemote &&
          !allowedUrlPrefixes.some((prefix) => url.startsWith(prefix))
        ) {
          delete record[key];
          continue;
        }
      }
      stripRemoteUrls(value);
    }
  }

  stripRemoteUrls(next);
  return next;
}

/** Coerce a value to a finite number, or return null. */
export function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

/** Check whether a column is mostly numeric in a sample of rows. */
export function isNumericColumn(
  column: string,
  rows: Array<Record<string, unknown>>,
): boolean {
  const sample = rows.slice(0, 25);
  if (!sample.length) return false;
  let numericCount = 0;
  let total = 0;
  for (const row of sample) {
    if (!(column in row)) continue;
    total += 1;
    if (coerceNumber(row[column]) !== null) {
      numericCount += 1;
    }
  }
  if (!total) return false;
  return numericCount / total >= 0.6;
}

/** Check whether a column is mostly date strings in a sample of rows. */
export function isDateColumn(
  column: string,
  rows: Array<Record<string, unknown>>,
): boolean {
  const sample = rows.slice(0, 25);
  if (!sample.length) return false;
  let dateCount = 0;
  let total = 0;
  for (const row of sample) {
    const value = row[column];
    if (value == null) continue;
    total += 1;
    if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
      dateCount += 1;
    }
  }
  if (!total) return false;
  return dateCount / total >= 0.6;
}

/** Strip dangerous HTML elements and event handlers. */
export function sanitizeArtifactHtml(input: string): string {
  let next = input;
  next = next.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  next = next.replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "");
  next = next.replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "");
  next = next.replace(/<embed[\s\S]*?>/gi, "");
  next = next.replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "");
  next = next.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");
  next = next.replace(
    /\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi,
    "",
  );
  return next.trim();
}
