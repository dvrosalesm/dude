/**
 * Canonical local SQLite path — single source of truth for all Dude persistence.
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DEFAULT_LOCAL_DB_PATH = path.join(
  os.homedir(),
  ".dude",
  "dude-local.sqlite",
);

/** Resolve the local SQLite file path (test override via DUDE_DB_PATH only). */
export function resolveCanonicalLocalDbPath(): string {
  const override = process.env.DUDE_DB_PATH?.trim();
  if (override) return override;
  return DEFAULT_LOCAL_DB_PATH;
}

/** Legacy desktop DB locations to merge into ~/.dude on first boot. */
export function legacyDesktopDbCandidates(): string[] {
  const home = process.env.HOME || os.homedir();
  if (process.platform === "darwin") {
    return [
      path.join(home, "Library", "Application Support", "Dude", "dude-local.sqlite"),
      path.join(home, "Library", "Application Support", "Electron", "dude-local.sqlite"),
      path.join(home, "Library", "Application Support", "dude", "dude-local.sqlite"),
    ];
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    return [
      path.join(appData, "Dude", "dude-local.sqlite"),
      path.join(appData, "Electron", "dude-local.sqlite"),
    ];
  }
  return [
    path.join(home, ".config", "Dude", "dude-local.sqlite"),
    path.join(home, ".config", "Electron", "dude-local.sqlite"),
  ];
}

/**
 * One-time merge: copy rows from legacy Electron userData DBs into ~/.dude/dude-local.sqlite.
 * Renames merged sources to *.migrated.{timestamp}.
 */
export function migrateLegacyDesktopDbs(): void {
  const target = resolveCanonicalLocalDbPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });

  for (const source of legacyDesktopDbCandidates()) {
    if (!fs.existsSync(source)) continue;
    if (path.resolve(source) === path.resolve(target)) continue;

    try {
      if (!fs.existsSync(target)) {
        fs.copyFileSync(source, target);
        console.log(`[migrate-local-db] Copied ${source} → ${target}`);
      } else {
        const targetDb = new Database(target);
        try {
          mergeLegacyDatabase(targetDb, source);
          console.log(`[migrate-local-db] Merged ${source} into ${target}`);
        } finally {
          targetDb.close();
        }
      }

      const migrated = `${source}.migrated.${Date.now()}`;
      fs.renameSync(source, migrated);
      console.log(`[migrate-local-db] Renamed legacy DB to ${migrated}`);
    } catch (error) {
      console.error(`[migrate-local-db] Failed to migrate ${source}:`, error);
    }
  }
}

function mergeLegacyDatabase(
  target: Database.Database,
  sourcePath: string,
): void {
  const escaped = sourcePath.replace(/'/g, "''");
  target.exec(`ATTACH DATABASE '${escaped}' AS legacy`);

  try {
    for (const table of [
      "workspaces",
      "threads",
      "files",
      "workspace_messages",
      "app_settings",
      "memories",
      "meta",
    ]) {
      mergeTableFromLegacy(target, table);
    }
  } finally {
    target.exec("DETACH DATABASE legacy");
  }
}

function mergeTableFromLegacy(
  target: Database.Database,
  table: string,
): void {
  const sourceExists = target
    .prepare(
      "SELECT name FROM legacy.sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    )
    .get(table);
  if (!sourceExists) return;

  target.exec(
    `CREATE TABLE IF NOT EXISTS main.${table} AS SELECT * FROM legacy.${table} WHERE 0`,
  );
  target.exec(
    `INSERT OR REPLACE INTO main.${table} SELECT * FROM legacy.${table}`,
  );
}
