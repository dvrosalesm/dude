import { Type } from "@sinclair/typebox";
import Database from "better-sqlite3";
import { config } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "@dude/sdk/gateway";
import { toolText } from "@dude/sdk/gateway-runtime";
import { guardDataAnalystSql } from "./da-sql-guard.js";

export function executeSql(
  query: string,
  workspaceId?: string,
): Record<string, unknown> {
  const wsId = workspaceId?.trim() || config.workspaceId?.trim();
  if (!wsId) {
    return { error: "No workspace ID configured for SQL execution." };
  }

  const dbPath = config.dbPath?.trim();
  if (!dbPath) {
    return { error: "No local database path configured." };
  }

  let guarded: string;
  try {
    guarded = guardDataAnalystSql(query, wsId);
  } catch (error: unknown) {
    return { error: String(error) };
  }

  const db = new Database(dbPath, { fileMustExist: false });
  try {
    const trimmed = guarded.trim();
    const isRead = /^(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(trimmed);

    if (isRead) {
      const stmt = db.prepare(guarded);
      const rows = stmt.all();
      const columns = rows.length > 0 ? Object.keys(rows[0] as object) : [];
      return { columns, rows };
    }

    const result = db.prepare(guarded).run();
    return { rowsAffected: result.changes };
  } catch (error: unknown) {
    return { error: String(error) };
  } finally {
    db.close();
  }
}

export function createSqlTool(): ToolDefinition {
  return {
    name: "sql",
    label: "SQL Query",
    description:
      "Execute a SQL query against the workspace dataset in the shared local SQLite database. " +
      "Returns { columns, rows } for SELECT queries, { rowsAffected } for writes. " +
      "Changes persist immediately. Max query length 8000 chars.",
    parameters: Type.Object({
      query: Type.String({ description: "SQL query to execute" }),
    }),
    execute: async (_toolCallId, params) => {
      return toolText(executeSql(params.query));
    },
  };
}
