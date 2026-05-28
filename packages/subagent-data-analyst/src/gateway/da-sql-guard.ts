/**
 * Guard and rewrite data-analyst SQL against the shared ~/.dude/dude-local.sqlite.
 * User tables are namespaced as da_{workspaceId}__{logicalName}.
 */

const APP_TABLES = new Set([
  "meta",
  "workspaces",
  "threads",
  "files",
  "workspace_messages",
  "app_settings",
  "memories",
]);

const BLOCKED_SQL =
  /\b(ATTACH\s+DATABASE|DETACH\s+DATABASE|load_extension|readfile|writefile|fts[345]\b)/i;

export function workspaceTablePrefix(workspaceId: string): string {
  const slug = workspaceId.replace(/-/g, "");
  return `da_${slug}__`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Block app tables and rewrite logical table names to prefixed physical names. */
export function guardDataAnalystSql(query: string, workspaceId: string): string {
  if (BLOCKED_SQL.test(query)) {
    throw new Error("This SQL operation is not allowed for security reasons.");
  }

  const prefix = workspaceTablePrefix(workspaceId);

  for (const table of APP_TABLES) {
    if (new RegExp(`\\b${escapeRegExp(table)}\\b`, "i").test(query)) {
      throw new Error(
        `Access to application table "${table}" is not allowed. Use your dataset tables only.`,
      );
    }
  }

  if (/sqlite_master|sqlite_schema/i.test(query) && !query.includes(prefix)) {
    throw new Error("System catalog queries are restricted.");
  }

  return rewriteLogicalTableNames(query, prefix);
}

/**
 * Rewrite unquoted identifiers that are not already prefixed and not SQL keywords.
 * Handles common CREATE / DML / SELECT patterns used by the analyst agent.
 */
function rewriteLogicalTableNames(query: string, prefix: string): string {
  let result = query;

  const patterns: RegExp[] = [
    /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"[]?)([a-zA-Z_][\w]*)\1/gi,
    /\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+([`"[]?)([a-zA-Z_][\w]*)\1/gi,
    /\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([`"[]?)([a-zA-Z_][\w]*)\1/gi,
    /\bALTER\s+TABLE\s+([`"[]?)([a-zA-Z_][\w]*)\1/gi,
  ];

  for (const pattern of patterns) {
    result = result.replace(pattern, (match, quote: string, name: string) => {
      if (!name || name.startsWith("da_") || APP_TABLES.has(name.toLowerCase())) {
        return match;
      }
      const physical = `${prefix}${name}`;
      return match.replace(name, physical);
    });
  }

  return result;
}
