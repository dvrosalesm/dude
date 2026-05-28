/**
 * Durable gateway chat session store — SQLite-backed persistence for
 * in-flight and completed turns. Survives API process restarts.
 */

import { getLocalDb } from "../local-sqlite.js";
import type {
  CompactionInfo,
  ConversationMessage,
} from "./conversation-message.js";
import type { ChatSession } from "./session-store.js";

function readJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function serializeMessage(message: ConversationMessage): string {
  const { pendingUserInput: _pending, ...rest } = message;
  return JSON.stringify(rest);
}

function deserializeMessage(payload: string): ConversationMessage {
  const parsed = readJson<ConversationMessage>(payload, {
    id: "",
    role: "assistant",
    content: "",
    status: "completed",
    createdAt: new Date().toISOString(),
  });
  return { ...parsed, pendingUserInput: null };
}

export function ensureTurnStoreSchema(): void {
  const database = getLocalDb();
  database.exec(`
    CREATE TABLE IF NOT EXISTS gateway_chat_sessions (
      workspace_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      compaction_json TEXT,
      PRIMARY KEY (workspace_id, session_id)
    );

    CREATE TABLE IF NOT EXISTS gateway_chat_messages (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      sort_index INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_gateway_chat_messages_session
      ON gateway_chat_messages (workspace_id, session_id, sort_index);
  `);
}

export function loadChatSession(
  workspaceId: string,
  sessionId: string,
): ChatSession | null {
  ensureTurnStoreSchema();
  const database = getLocalDb();
  const row = database
    .prepare(
      `SELECT workspace_id, session_id, created_at, compaction_json
       FROM gateway_chat_sessions
       WHERE workspace_id = ? AND session_id = ?
       LIMIT 1`,
    )
    .get(workspaceId, sessionId) as
    | {
        workspace_id: string;
        session_id: string;
        created_at: string;
        compaction_json: string | null;
      }
    | undefined;

  if (!row) return null;

  const messageRows = database
    .prepare(
      `SELECT payload_json
       FROM gateway_chat_messages
       WHERE workspace_id = ? AND session_id = ?
       ORDER BY sort_index ASC`,
    )
    .all(workspaceId, sessionId) as Array<{ payload_json: string }>;

  return {
    sessionId: row.session_id,
    workspaceId: row.workspace_id,
    createdAt: row.created_at,
    compaction: readJson<CompactionInfo | undefined>(
      row.compaction_json ?? undefined,
      undefined,
    ),
    messages: messageRows.map((entry) => deserializeMessage(entry.payload_json)),
  };
}

export function listChatSessionsForWorkspace(
  workspaceId: string,
): ChatSession[] {
  ensureTurnStoreSchema();
  const database = getLocalDb();
  const rows = database
    .prepare(
      `SELECT session_id
       FROM gateway_chat_sessions
       WHERE workspace_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(workspaceId) as Array<{ session_id: string }>;

  const sessions: ChatSession[] = [];
  for (const row of rows) {
    const session = loadChatSession(workspaceId, row.session_id);
    if (session) sessions.push(session);
  }
  return sessions;
}

export function saveChatSession(session: ChatSession): void {
  ensureTurnStoreSchema();
  const database = getLocalDb();
  const now = new Date().toISOString();
  const compactionJson = session.compaction
    ? JSON.stringify(session.compaction)
    : null;

  database
    .prepare(
      `INSERT INTO gateway_chat_sessions (
        workspace_id, session_id, created_at, updated_at, compaction_json
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, session_id) DO UPDATE SET
        updated_at = excluded.updated_at,
        compaction_json = excluded.compaction_json`,
    )
    .run(
      session.workspaceId,
      session.sessionId,
      session.createdAt,
      now,
      compactionJson,
    );

  const upsertMessage = database.prepare(
    `INSERT INTO gateway_chat_messages (
      id, workspace_id, session_id, sort_index, payload_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      sort_index = excluded.sort_index,
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at`,
  );

  const deleteStale = database.prepare(
    `DELETE FROM gateway_chat_messages
     WHERE workspace_id = ? AND session_id = ? AND id NOT IN (
       SELECT value FROM json_each(?)
     )`,
  );

  const messageIds = session.messages.map((message) => message.id);
  const deleteIdsJson = JSON.stringify(messageIds.length ? messageIds : ["__none__"]);

  deleteStale.run(session.workspaceId, session.sessionId, deleteIdsJson);

  session.messages.forEach((message, index) => {
    upsertMessage.run(
      message.id,
      session.workspaceId,
      session.sessionId,
      index,
      serializeMessage(message),
      now,
    );
  });
}

export function deleteChatSessionsForWorkspace(workspaceId: string): void {
  ensureTurnStoreSchema();
  const database = getLocalDb();
  database
    .prepare(`DELETE FROM gateway_chat_messages WHERE workspace_id = ?`)
    .run(workspaceId);
  database
    .prepare(`DELETE FROM gateway_chat_sessions WHERE workspace_id = ?`)
    .run(workspaceId);
}

const INTERRUPTED_TURN_ERROR = "Turn interrupted by server restart";

export function markInterruptedProcessingMessage(
  message: ConversationMessage,
): ConversationMessage {
  if (message.status !== "processing") return message;
  return {
    ...message,
    status: "error",
    error: INTERRUPTED_TURN_ERROR,
    pendingUserInput: null,
  };
}

/** Mark orphaned in-flight turns after API restart. */
export function recoverStaleProcessingTurns(): number {
  ensureTurnStoreSchema();
  const database = getLocalDb();
  const rows = database
    .prepare(`SELECT id, payload_json FROM gateway_chat_messages`)
    .all() as Array<{ id: string; payload_json: string }>;

  const update = database.prepare(
    `UPDATE gateway_chat_messages
     SET payload_json = ?, updated_at = ?
     WHERE id = ?`,
  );

  let recovered = 0;
  const now = new Date().toISOString();
  for (const row of rows) {
    const message = deserializeMessage(row.payload_json);
    const interrupted = markInterruptedProcessingMessage(message);
    if (interrupted.status === message.status) continue;
    update.run(serializeMessage(interrupted), now, row.id);
    recovered += 1;
  }
  return recovered;
}
