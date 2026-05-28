"use client";

import * as XLSX from "xlsx";
import type { IngestPreview, ParsedFile } from "./types";

export {
  normalizeIdentifier,
  ensureUniqueIdentifiers,
  inferColumnType,
  buildTableSchema,
} from "@dude/data-analyst-core/column-utils";

import { inferColumnType } from "@dude/data-analyst-core/column-utils";

export type IngestSourceKind = "csv" | "xlsx";

export type IngestParseOptions = {
  source: IngestSourceKind;
  delimiter?: string;
  encoding?: string;
  hasHeaderRow?: boolean;
};

export type ColumnStat = {
  header: string;
  nullCount: number;
  uniqueCount: number;
  totalRows: number;
  sampleValues: string[];
  inferredType: { type: string; format?: string };
};

export type IngestIssue =
  | { kind: "high_nulls"; header: string; percent: number }
  | { kind: "id_as_string"; header: string; digits: number }
  | { kind: "duplicate_columns"; header: string; otherHeader: string; match: number };

const SAMPLE_SIZE = 2;
const HIGH_NULL_THRESHOLD = 0.25;
const DUPLICATE_THRESHOLD = 0.94;

function extensionFor(source: IngestSourceKind) {
  return source === "csv" ? "csv" : "xlsx";
}

function fileLooksLike(file: File, source: IngestSourceKind) {
  const name = file.name.toLowerCase();
  return name.endsWith(`.${extensionFor(source)}`);
}

async function readCsvAsText(file: File, encoding: string) {
  const buffer = await file.arrayBuffer();
  try {
    const decoder = new TextDecoder(encoding.toLowerCase());
    return decoder.decode(buffer);
  } catch {
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(buffer);
  }
}

async function parseRawRows(
  file: File,
  options: IngestParseOptions,
): Promise<Array<Array<unknown>>> {
  if (options.source === "csv" || !fileLooksLike(file, "xlsx")) {
    const text = await readCsvAsText(file, options.encoding || "UTF-8");
    const workbook = XLSX.read(text, {
      type: "string",
      FS: options.delimiter || ",",
      raw: false,
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
    }) as Array<Array<unknown>>;
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as Array<Array<unknown>>;
}

function toHeadersAndRows(
  rawRows: Array<Array<unknown>>,
  hasHeaderRow: boolean,
): ParsedFile {
  if (rawRows.length === 0) return { headers: [], rows: [] };

  const columnCount = rawRows.reduce(
    (max, row) => Math.max(max, row.length),
    0,
  );

  if (hasHeaderRow) {
    const [headerRow = [], ...dataRows] = rawRows;
    const headers = Array.from({ length: columnCount }, (_, index) => {
      const cell = headerRow[index];
      const label = cell != null ? String(cell).trim() : "";
      return label || `column_${index + 1}`;
    });
    const rows = dataRows.map((row) =>
      headers.map((_, index) => String(row?.[index] ?? "")),
    );
    return { headers, rows };
  }

  const headers = Array.from(
    { length: columnCount },
    (_, index) => `column_${index + 1}`,
  );
  const rows = rawRows.map((row) =>
    headers.map((_, index) => String(row?.[index] ?? "")),
  );
  return { headers, rows };
}

export async function parseFile(
  file: File,
  options: IngestParseOptions,
): Promise<ParsedFile> {
  const rawRows = await parseRawRows(file, options);
  return toHeadersAndRows(rawRows, options.hasHeaderRow ?? true);
}

export async function buildPreviewFromFile(
  file: File,
  options?: Partial<IngestParseOptions>,
): Promise<IngestPreview> {
  const parsed = await parseFile(file, {
    source: options?.source || (file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx"),
    delimiter: options?.delimiter,
    encoding: options?.encoding,
    hasHeaderRow: options?.hasHeaderRow ?? true,
  });
  return { headers: parsed.headers, rows: parsed.rows.slice(0, 8) };
}

export function computeColumnStats(parsed: ParsedFile): ColumnStat[] {
  const { headers, rows } = parsed;
  const totalRows = rows.length;

  return headers.map((header, colIndex) => {
    const values = rows.map((row) => row[colIndex] ?? "");
    let nullCount = 0;
    const uniqueSet = new Set<string>();
    const sampleValues: string[] = [];

    for (const raw of values) {
      const value = raw.trim();
      if (!value) {
        nullCount += 1;
        continue;
      }
      uniqueSet.add(value);
      if (sampleValues.length < SAMPLE_SIZE && !sampleValues.includes(value)) {
        sampleValues.push(value);
      }
    }

    return {
      header,
      nullCount,
      uniqueCount: uniqueSet.size,
      totalRows,
      sampleValues,
      inferredType: inferColumnType(values),
    };
  });
}

function nonEmptyValueSet(values: string[]) {
  const set = new Set<string>();
  for (const raw of values) {
    const value = raw.trim();
    if (value) set.add(value);
  }
  return set;
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = smaller === a ? b : a;
  for (const value of smaller) {
    if (larger.has(value)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function looksLikeIdColumn(header: string) {
  return /(^|_)id(_|$)|number|dpi|code|otp/.test(header.toLowerCase());
}

function digitRunLength(sampleValues: string[]) {
  const digitLengths = sampleValues
    .map((value) => value.replace(/\D/g, ""))
    .filter((digits) => digits.length > 0)
    .map((digits) => digits.length);
  if (digitLengths.length === 0) return 0;
  return Math.min(...digitLengths);
}

export function detectIssues(
  parsed: ParsedFile,
  stats: ColumnStat[],
): IngestIssue[] {
  const issues: IngestIssue[] = [];
  const { headers, rows } = parsed;
  const totalRows = rows.length;

  for (const stat of stats) {
    if (totalRows > 0 && stat.nullCount / totalRows >= HIGH_NULL_THRESHOLD) {
      issues.push({
        kind: "high_nulls",
        header: stat.header,
        percent: Math.round((stat.nullCount / totalRows) * 100),
      });
    }
    if (stat.inferredType.type === "text" && looksLikeIdColumn(stat.header)) {
      const digits = digitRunLength(stat.sampleValues);
      if (digits >= 10) {
        issues.push({ kind: "id_as_string", header: stat.header, digits });
      }
    }
  }

  const valueSets = headers.map((_, colIndex) =>
    nonEmptyValueSet(rows.map((row) => row[colIndex] ?? "")),
  );

  for (let i = 0; i < headers.length; i += 1) {
    for (let j = i + 1; j < headers.length; j += 1) {
      const score = jaccard(valueSets[i], valueSets[j]);
      if (score >= DUPLICATE_THRESHOLD) {
        issues.push({
          kind: "duplicate_columns",
          header: headers[j],
          otherHeader: headers[i],
          match: Math.round(score * 100),
        });
      }
    }
  }

  return issues;
}

export function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

export async function sniffCsvDelimiter(file: File, encoding: string) {
  const blob = file.slice(0, 4096);
  const buffer = await blob.arrayBuffer();
  try {
    const decoder = new TextDecoder(encoding.toLowerCase());
    return detectDelimiter(decoder.decode(buffer));
  } catch {
    return ",";
  }
}
