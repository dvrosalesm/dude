import type { LocalSubagentWorkspace } from "@dude/client-types";

function unquoteSqlIdentifier(value: string) {
  return value.replace(/^["'`]|["'`]$/g, "");
}

function filterRows(rows: Array<Record<string, string>>, query: string) {
  const likeMatch = query.match(/LIKE\s+'%([^']*)%'/i);
  if (!likeMatch) return rows;
  const needle = likeMatch[1].toLowerCase();
  return rows.filter((row) =>
    Object.values(row).some((value) => String(value).toLowerCase().includes(needle)),
  );
}

export function getLocalTables(workspace: LocalSubagentWorkspace) {
  const tables = workspace.configurations.localTables;
  return tables && typeof tables === "object"
    ? (tables as Record<string, Array<Record<string, string>>>)
    : {};
}

export function getSchemaTables(workspace: LocalSubagentWorkspace) {
  const schema = workspace.configurations.schema;
  if (!schema || typeof schema !== "object") return {};
  const tables = (schema as Record<string, unknown>).tables;
  return tables && typeof tables === "object"
    ? (tables as Record<string, { columns?: Array<{ name: string; type?: string }>; rowCount?: number }>)
    : {};
}

export function queryLocalTables(workspace: LocalSubagentWorkspace, query: string) {
  const trimmed = query.trim();
  const tables = getLocalTables(workspace);
  const schemaTables = getSchemaTables(workspace);

  if (/sqlite_master/i.test(trimmed)) {
    return {
      columns: ["name"],
      rows: Object.keys(schemaTables).map((name) => ({ name })),
    };
  }

  const pragmaMatch = trimmed.match(/PRAGMA\s+table_info\(([^)]+)\)/i);
  if (pragmaMatch) {
    const tableName = unquoteSqlIdentifier(pragmaMatch[1].trim());
    const columns = schemaTables[tableName]?.columns ?? [];
    return {
      columns: ["cid", "name", "type"],
      rows: columns.map((column, index) => ({
        cid: index,
        name: column.name,
        type: column.type ?? "text",
      })),
    };
  }

  const countMatch = trimmed.match(/SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+["'`]?([^"'`\s;]+)["'`]?/i);
  if (countMatch) {
    const tableName = countMatch[1];
    const rows = filterRows(tables[tableName] ?? [], trimmed);
    return { columns: ["count"], rows: [{ count: rows.length }] };
  }

  const selectMatch = trimmed.match(/SELECT\s+\*\s+FROM\s+["'`]?([^"'`\s;]+)["'`]?/i);
  if (selectMatch) {
    const tableName = selectMatch[1];
    const limit = Number(trimmed.match(/LIMIT\s+(\d+)/i)?.[1] ?? 25);
    const rows = filterRows(tables[tableName] ?? [], trimmed).slice(0, limit);
    const columns =
      schemaTables[tableName]?.columns?.map((column) => column.name) ??
      Object.keys(rows[0] ?? {});
    return { columns, rows };
  }

  return { columns: [], rows: [] };
}
