/**
 * Local SQLite store — shared with the Electron desktop app.
 *
 * Single canonical path: ~/.dude/dude-local.sqlite (override: DUDE_DB_PATH for tests).
 */

import Database from "better-sqlite3";
import { getRequestDbPath } from "./request-db-context.js";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  migrateLegacyDesktopDbs,
  resolveCanonicalLocalDbPath,
} from "./local-db-path.js";

const SCHEMA_VERSION = 2;

const dbByPath = new Map<string, Database.Database>();

function resolveDbPath(): string {
  const fromRequest = getRequestDbPath();
  if (fromRequest?.trim()) {
    return fromRequest.trim();
  }
  return resolveCanonicalLocalDbPath();
}

export function getLocalDbPath(): string {
  return resolveDbPath();
}

function ensureSchema(database: Database.Database) {
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  database.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      specialist_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      configurations TEXT NOT NULL DEFAULT '{}',
      data TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_workspaces_specialist
      ON workspaces (specialist_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS threads (
      key TEXT PRIMARY KEY,
      messages TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspace_messages (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_workspace_messages_ws
      ON workspace_messages (workspace_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      applies_to TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const versionRow = database
    .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
    .get() as { value: string } | undefined;

  if (!versionRow) {
    database
      .prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?)")
      .run(String(SCHEMA_VERSION));
  }

  database.exec("DROP TABLE IF EXISTS organizations");
}

export function getLocalDb(): Database.Database {
  const dbPath = path.resolve(resolveDbPath());
  const existing = dbByPath.get(dbPath);
  if (existing) return existing;

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const database = new Database(dbPath);
  ensureSchema(database);
  dbByPath.set(dbPath, database);
  return database;
}

/** Close cached connections — for tests only. */
export function resetLocalDbCacheForTests(): void {
  for (const database of dbByPath.values()) {
    database.close();
  }
  dbByPath.clear();
}

function readJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function getWorkspaceConfigurations(
  workspaceId: string,
): Record<string, unknown> {
  const database = getLocalDb();
  const row = database
    .prepare(
      "SELECT configurations, data FROM workspaces WHERE id = ? LIMIT 1",
    )
    .get(workspaceId) as
    | { configurations: string; data: string | null }
    | undefined;

  if (row) {
    const fromColumn = readJson<Record<string, unknown>>(row.configurations, {});
    const fromData = readJson<{ configurations?: Record<string, unknown> }>(
      row.data,
      {},
    );
    return {
      ...(fromData.configurations ?? {}),
      ...fromColumn,
    };
  }

  const settingsKey = `workspace-config:${workspaceId}`;
  const settings = database
    .prepare("SELECT value FROM app_settings WHERE key = ? LIMIT 1")
    .get(settingsKey) as { value: string } | undefined;

  return readJson<Record<string, unknown>>(settings?.value, {});
}

export function setWorkspaceConfigurations(
  workspaceId: string,
  config: Record<string, unknown>,
): void {
  const database = getLocalDb();
  const now = new Date().toISOString();
  const configJson = JSON.stringify(config);

  const existing = database
    .prepare("SELECT id FROM workspaces WHERE id = ? LIMIT 1")
    .get(workspaceId) as { id: string } | undefined;

  if (existing) {
    database
      .prepare(
        "UPDATE workspaces SET configurations = ?, updated_at = ? WHERE id = ?",
      )
      .run(configJson, now, workspaceId);

    const dataRow = database
      .prepare("SELECT data FROM workspaces WHERE id = ? LIMIT 1")
      .get(workspaceId) as { data: string | null } | undefined;

    if (dataRow?.data) {
      const parsed = readJson<Record<string, unknown>>(dataRow.data, {});
      parsed.configurations = config;
      database
        .prepare("UPDATE workspaces SET data = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(parsed), now, workspaceId);
    }
    return;
  }

  const settingsKey = `workspace-config:${workspaceId}`;
  database
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(settingsKey, configJson, now);
}

export function listWorkspacesBySpecialist(specialistId: string) {
  const database = getLocalDb();
  const rows = database
    .prepare(
      `SELECT id, name, updated_at AS date
       FROM workspaces
       WHERE specialist_id = ?
       ORDER BY updated_at DESC
       LIMIT 50`,
    )
    .all(specialistId) as Array<{ id: string; name: string; date: string }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    date: row.date,
  }));
}

export function createWorkspaceRecord(input: {
  id: string;
  specialistId: string;
  name: string;
  status?: string;
  configurations?: Record<string, unknown>;
}) {
  const database = getLocalDb();
  const now = new Date().toISOString();
  const configurations = input.configurations ?? {};

  const workspaceData = {
    id: input.id,
    specialistId: input.specialistId,
    name: input.name,
    status: input.status ?? "draft",
    createdAt: now,
    updatedAt: now,
    configurations,
  };

  database
    .prepare(
      `INSERT INTO workspaces (
        id, specialist_id, name, status, configurations, data, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.id,
      input.specialistId,
      input.name,
      input.status ?? "draft",
      JSON.stringify(configurations),
      JSON.stringify(workspaceData),
      now,
      now,
    );

  return {
    id: input.id,
    name: input.name,
    date: now,
  };
}

export function insertWorkspaceMessage(input: {
  workspaceId: string;
  role: string;
  content: string;
}) {
  const database = getLocalDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO workspace_messages (id, workspace_id, role, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, input.workspaceId, input.role, input.content, now);
}

export function listWorkspaceMessages(workspaceId: string, limit = 20) {
  const database = getLocalDb();
  const rows = database
    .prepare(
      `SELECT role, content, created_at AS createdAt
       FROM workspace_messages
       WHERE workspace_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(workspaceId, limit) as Array<{
      role: string;
      content: string;
      createdAt: string;
    }>;

  return rows.reverse();
}

function getAppSetting<T>(key: string, fallback: T): T {
  const database = getLocalDb();
  const row = database
    .prepare("SELECT value FROM app_settings WHERE key = ? LIMIT 1")
    .get(key) as { value: string } | undefined;
  return readJson<T>(row?.value, fallback);
}

function setAppSetting(key: string, value: unknown): void {
  const database = getLocalDb();
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, JSON.stringify(value), now);
}

export interface LocalAssistantConfig {
  system_prompt: string;
  enabled: boolean;
  enabled_specialists: string[];
  max_iterations: number;
  approval_mode: "auto" | "draft" | "per-step";
  model: string | null;
  provider: string | null;
  updated_at: string;
}

const DEFAULT_ASSISTANT_CONFIG: Omit<LocalAssistantConfig, "updated_at"> = {
  system_prompt: "",
  enabled: true,
  enabled_specialists: [],
  max_iterations: 25,
  approval_mode: "auto",
  model: null,
  provider: null,
};

export function getAssistantConfig(): LocalAssistantConfig {
  const stored = getAppSetting<Partial<LocalAssistantConfig>>(
    "assistant-config",
    {},
  );
  return {
    ...DEFAULT_ASSISTANT_CONFIG,
    ...stored,
    updated_at: stored.updated_at ?? new Date().toISOString(),
  };
}

export function putAssistantConfig(
  patch: Partial<Omit<LocalAssistantConfig, "updated_at">>,
): LocalAssistantConfig {
  const current = getAssistantConfig();
  const merged: LocalAssistantConfig = {
    ...current,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  setAppSetting("assistant-config", merged);
  return merged;
}

export interface LocalMemory {
  id: string;
  title: string;
  content: string;
  tags: string[];
  applies_to: string[];
  created_at: string;
  updated_at: string;
}

export function listMemories(): LocalMemory[] {
  const database = getLocalDb();
  const rows = database
    .prepare(
      `SELECT id, title, content, tags, applies_to, created_at, updated_at
       FROM memories
       ORDER BY updated_at DESC`,
    )
    .all() as Array<{
    id: string;
    title: string;
    content: string;
    tags: string;
    applies_to: string;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    tags: readJson<string[]>(row.tags, []),
    applies_to: readJson<string[]>(row.applies_to, []),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export function upsertMemory(input: {
  id?: string;
  title: string;
  content: string;
  tags?: string[];
  applies_to?: string[];
}): LocalMemory {
  const database = getLocalDb();
  const id = input.id ?? randomUUID();
  const now = new Date().toISOString();
  const existing = database
    .prepare("SELECT id FROM memories WHERE id = ? LIMIT 1")
    .get(id) as { id: string } | undefined;

  if (existing) {
    database
      .prepare(
        `UPDATE memories
         SET title = ?, content = ?, tags = ?, applies_to = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.title,
        input.content,
        JSON.stringify(input.tags ?? []),
        JSON.stringify(input.applies_to ?? []),
        now,
        id,
      );
  } else {
    database
      .prepare(
        `INSERT INTO memories (id, title, content, tags, applies_to, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.title,
        input.content,
        JSON.stringify(input.tags ?? []),
        JSON.stringify(input.applies_to ?? []),
        now,
        now,
      );
  }

  return {
    id,
    title: input.title,
    content: input.content,
    tags: input.tags ?? [],
    applies_to: input.applies_to ?? [],
    created_at: existing ? now : now,
    updated_at: now,
  };
}

export function getWorkspaceRecord(workspaceId: string) {
  const database = getLocalDb();
  const row = database
    .prepare(
      `SELECT id, specialist_id, name, status, configurations, data, updated_at
       FROM workspaces WHERE id = ? LIMIT 1`,
    )
    .get(workspaceId) as
    | {
        id: string;
        specialist_id: string;
        name: string;
        status: string;
        configurations: string;
        data: string | null;
        updated_at: string;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    specialistId: row.specialist_id,
    name: row.name,
    status: row.status,
    configurations: readJson<Record<string, unknown>>(row.configurations, {}),
    data: readJson<Record<string, unknown> | null>(row.data, null),
    updatedAt: row.updated_at,
  };
}
