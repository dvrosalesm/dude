import { Client } from "pg";

type WorkspaceSchema = {
  tables: Record<
    string,
    {
      columns: Array<{
        name: string;
        type: string;
        format?: string;
      }>;
      rowCount: number;
    }
  >;
  updatedAt: string;
};

export type DirectDatabaseProvider = "postgres";

export type DirectDatabaseConfig = {
  id: string;
  name: string;
  provider: DirectDatabaseProvider;
  connectionString: string;
  schema?: string;
  ssl?: boolean;
  readonly?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type RedactedDirectDatabaseConfig = Omit<
  DirectDatabaseConfig,
  "connectionString"
> & {
  hasConnectionString: boolean;
};

const QUERY_TIMEOUT_MS = 30_000;
const MAX_DIRECT_QUERY_ROWS = 5_000;

export function isDirectDatabaseConfig(value: unknown): value is DirectDatabaseConfig {
  if (!value || typeof value !== "object") return false;
  const cfg = value as Record<string, unknown>;
  return (
    typeof cfg.id === "string" &&
    typeof cfg.name === "string" &&
    cfg.provider === "postgres" &&
    typeof cfg.connectionString === "string" &&
    cfg.connectionString.trim().length > 0
  );
}

export function redactDirectDatabaseConfig(
  config: DirectDatabaseConfig,
): RedactedDirectDatabaseConfig {
  return {
    id: config.id,
    name: config.name,
    provider: config.provider,
    schema: config.schema,
    ssl: config.ssl,
    readonly: config.readonly,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    hasConnectionString: Boolean(config.connectionString),
  };
}

export function getDirectDatabaseConnections(
  configurations: Record<string, unknown> | null | undefined,
): DirectDatabaseConfig[] {
  const directDatabase = configurations?.directDatabase as
    | { connections?: unknown[] }
    | undefined;
  if (!Array.isArray(directDatabase?.connections)) return [];
  return directDatabase.connections.filter(isDirectDatabaseConfig);
}

export function getActiveDirectDatabaseConnection(
  configurations: Record<string, unknown> | null | undefined,
): DirectDatabaseConfig | null {
  const directDatabase = configurations?.directDatabase as
    | { activeConnectionId?: unknown; connections?: unknown[] }
    | undefined;
  const connections = getDirectDatabaseConnections(configurations);
  if (!connections.length) return null;
  const activeId =
    typeof directDatabase?.activeConnectionId === "string"
      ? directDatabase.activeConnectionId
      : null;
  return connections.find((connection) => connection.id === activeId) ?? connections[0];
}

function createPostgresClient(config: DirectDatabaseConfig) {
  return new Client({
    connectionString: config.connectionString,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10_000,
    query_timeout: QUERY_TIMEOUT_MS,
    statement_timeout: QUERY_TIMEOUT_MS,
  });
}

function ensureSingleReadonlyStatement(query: string) {
  const trimmed = query.trim().replace(/;+\s*$/, "");
  if (!trimmed) {
    throw new Error("Query is required");
  }
  if (trimmed.includes(";")) {
    throw new Error("Only one SQL statement is allowed");
  }
  if (!/^(select|with|show|explain)\b/i.test(trimmed)) {
    throw new Error("Only read-only SQL queries are allowed for direct databases");
  }
  return trimmed;
}

export async function runDirectDatabaseQuery(
  config: DirectDatabaseConfig,
  query: string,
) {
  const sql = ensureSingleReadonlyStatement(query);
  const client = createPostgresClient(config);
  await client.connect();

  try {
    await client.query("BEGIN READ ONLY");
    await client.query(`SET LOCAL statement_timeout = ${QUERY_TIMEOUT_MS}`);
    const result = await client.query(sql);
    await client.query("ROLLBACK");

    return {
      columns: result.fields.map((field) => field.name),
      rows: result.rows.slice(0, MAX_DIRECT_QUERY_ROWS),
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    await client.end();
  }
}

export async function inspectDirectDatabaseSchema(
  config: DirectDatabaseConfig,
): Promise<WorkspaceSchema> {
  const client = createPostgresClient(config);
  await client.connect();

  try {
    const schemaFilter = config.schema?.trim();
    const params = schemaFilter ? [schemaFilter] : [];
    const whereSchema = schemaFilter
      ? "AND c.table_schema = $1"
      : "AND c.table_schema NOT IN ('pg_catalog', 'information_schema')";
    const result = await client.query(
      `
      SELECT
        c.table_schema,
        c.table_name,
        c.column_name,
        c.data_type,
        c.ordinal_position,
        COALESCE(cls.reltuples, 0)::bigint AS estimated_rows
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
        AND t.table_name = c.table_name
      LEFT JOIN pg_catalog.pg_namespace ns ON ns.nspname = c.table_schema
      LEFT JOIN pg_catalog.pg_class cls
        ON cls.relname = c.table_name
        AND cls.relnamespace = ns.oid
        AND cls.relkind IN ('r', 'p', 'v', 'm')
      WHERE t.table_type IN ('BASE TABLE', 'VIEW')
      ${whereSchema}
      ORDER BY c.table_schema, c.table_name, c.ordinal_position
      `,
      params,
    );

    const tables: WorkspaceSchema["tables"] = {};
    for (const row of result.rows as Array<{
      table_schema: string;
      table_name: string;
      column_name: string;
      data_type: string;
      estimated_rows: string | number;
    }>) {
      const tableName = `${row.table_schema}.${row.table_name}`;
      tables[tableName] ??= {
        columns: [],
        rowCount: Math.max(0, Number(row.estimated_rows) || 0),
      };
      tables[tableName].columns.push({
        name: row.column_name,
        type: row.data_type,
      });
    }

    return {
      tables,
      updatedAt: new Date().toISOString(),
    };
  } finally {
    await client.end();
  }
}
