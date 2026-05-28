import type { WorkspaceSchema, QualityScanResult, QualityScanTable, QualityScanColumn } from "../types";

/**
 * Build a single SQL query per table that counts NULLs, empty strings, and
 * duplicates for every column. Returns one row with all aggregated counts.
 */
export function buildQualityQuery(
  tableName: string,
  columns: Array<{ name: string }>,
): string {
  const parts: string[] = [`COUNT(*) as _total_rows`];

  for (const col of columns) {
    const c = `"${col.name}"`;
    parts.push(`SUM(CASE WHEN ${c} IS NULL THEN 1 ELSE 0 END) as "${col.name}__nulls"`);
    parts.push(`SUM(CASE WHEN CAST(${c} AS TEXT) = '' THEN 1 ELSE 0 END) as "${col.name}__empty"`);
    parts.push(`(COUNT(${c}) - COUNT(DISTINCT ${c})) as "${col.name}__dupes"`);
  }

  return `SELECT ${parts.join(", ")} FROM "${tableName}"`;
}

/**
 * Parse the query result row into structured QualityScanColumn entries.
 */
export function parseQualityRow(
  tableName: string,
  columns: Array<{ name: string }>,
  row: Record<string, unknown>,
): QualityScanTable {
  const totalRows = Number(row._total_rows) || 0;
  const scanColumns: QualityScanColumn[] = columns.map((col) => ({
    column: col.name,
    nullCount: Number(row[`${col.name}__nulls`]) || 0,
    emptyCount: Number(row[`${col.name}__empty`]) || 0,
    duplicateCount: Number(row[`${col.name}__dupes`]) || 0,
    totalRows,
  }));

  return { table: tableName, columns: scanColumns, totalRows };
}

/**
 * Compute an overall quality score (0-100) from scan results.
 * 100 = no issues, 0 = every cell has an issue.
 */
export function computeQualityScore(tables: QualityScanTable[]): number {
  let totalCells = 0;
  let issueCells = 0;

  for (const table of tables) {
    for (const col of table.columns) {
      totalCells += col.totalRows;
      issueCells += col.nullCount + col.emptyCount;
    }
  }

  if (totalCells === 0) return 100;
  return Math.round(((totalCells - issueCells) / totalCells) * 100);
}

/**
 * Run the full quality scan for a workspace schema.
 */
export async function runQualityScan(
  schema: WorkspaceSchema,
  runSql: (query: string) => Promise<{ columns: string[]; rows: Array<Record<string, unknown>> }>,
): Promise<QualityScanResult> {
  const tableNames = Object.keys(schema.tables);
  const tableResults = await Promise.all(
    tableNames.map(async (tableName) => {
      const table = schema.tables[tableName];
      const query = buildQualityQuery(tableName, table.columns);
      try {
        const result = await runSql(query);
        if (result.rows.length > 0) {
          return parseQualityRow(tableName, table.columns, result.rows[0]);
        }
      } catch {
        // Skip tables that fail
      }
      return {
        table: tableName,
        columns: table.columns.map((col) => ({
          column: col.name,
          nullCount: 0,
          emptyCount: 0,
          duplicateCount: 0,
          totalRows: table.rowCount,
        })),
        totalRows: table.rowCount,
      };
    }),
  );

  return {
    tables: tableResults,
    overallScore: computeQualityScore(tableResults),
  };
}
