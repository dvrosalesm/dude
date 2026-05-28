import type { WorkspaceSchema, ColumnStats } from "../types";

function isNumericType(type: string): boolean {
  const t = type.toLowerCase();
  return (
    t.includes("int") ||
    t.includes("float") ||
    t.includes("double") ||
    t.includes("decimal") ||
    t.includes("numeric") ||
    t.includes("real") ||
    t.includes("number")
  );
}

/**
 * Build a single SQL query per table that computes:
 * - MIN, MAX, AVG for numeric columns
 * - COUNT(DISTINCT ...) for text columns
 */
export function buildStatsQuery(
  tableName: string,
  columns: Array<{ name: string; type: string }>,
): string {
  const parts: string[] = [`COUNT(*) as _total_rows`];

  for (const col of columns) {
    const c = `"${col.name}"`;
    if (isNumericType(col.type)) {
      parts.push(`MIN(CAST(${c} AS REAL)) as "${col.name}__min"`);
      parts.push(`MAX(CAST(${c} AS REAL)) as "${col.name}__max"`);
      parts.push(`AVG(CAST(${c} AS REAL)) as "${col.name}__avg"`);
    } else {
      parts.push(`COUNT(DISTINCT ${c}) as "${col.name}__card"`);
    }
  }

  return `SELECT ${parts.join(", ")} FROM "${tableName}"`;
}

/**
 * Build a median query for a single numeric column.
 */
export function buildMedianQuery(tableName: string, column: string): string {
  return `SELECT "${column}" as val FROM "${tableName}" WHERE "${column}" IS NOT NULL AND "${column}" != '' ORDER BY CAST("${column}" AS REAL) LIMIT 1 OFFSET (SELECT COUNT("${column}") FROM "${tableName}" WHERE "${column}" IS NOT NULL AND "${column}" != '') / 2`;
}

/**
 * Run column statistics for a workspace schema.
 */
export async function runColumnStats(
  schema: WorkspaceSchema,
  runSql: (query: string) => Promise<{ columns: string[]; rows: Array<Record<string, unknown>> }>,
): Promise<Record<string, ColumnStats[]>> {
  const result: Record<string, ColumnStats[]> = {};
  const tableNames = Object.keys(schema.tables);

  await Promise.all(
    tableNames.map(async (tableName) => {
      const table = schema.tables[tableName];
      const columns = table.columns;

      try {
        // Main stats query
        const statsResult = await runSql(buildStatsQuery(tableName, columns));
        const row = statsResult.rows[0] || {};
        const totalRows = Number(row._total_rows) || 0;

        // Compute medians for numeric columns (skip for large tables)
        const numericCols = columns.filter((c) => isNumericType(c.type));
        const medians: Record<string, number | undefined> = {};

        if (totalRows <= 100_000) {
          await Promise.all(
            numericCols.map(async (col) => {
              try {
                const medianResult = await runSql(
                  buildMedianQuery(tableName, col.name),
                );
                if (medianResult.rows.length > 0) {
                  medians[col.name] = Number(medianResult.rows[0].val) || undefined;
                }
              } catch {
                // Skip median on failure
              }
            }),
          );
        }

        result[tableName] = columns.map((col) => {
          if (isNumericType(col.type)) {
            return {
              column: col.name,
              type: "numeric" as const,
              min: row[`${col.name}__min`] != null ? Number(row[`${col.name}__min`]) : undefined,
              max: row[`${col.name}__max`] != null ? Number(row[`${col.name}__max`]) : undefined,
              avg: row[`${col.name}__avg`] != null ? Math.round(Number(row[`${col.name}__avg`]) * 100) / 100 : undefined,
              median: medians[col.name],
              totalRows,
            };
          }
          return {
            column: col.name,
            type: "text" as const,
            cardinality: Number(row[`${col.name}__card`]) || 0,
            totalRows,
          };
        });
      } catch {
        // Return empty stats on failure
        result[tableName] = columns.map((col) => ({
          column: col.name,
          type: isNumericType(col.type) ? ("numeric" as const) : ("text" as const),
          totalRows: table.rowCount,
        }));
      }
    }),
  );

  return result;
}
