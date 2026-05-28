/**
 * Memory store — local SQLite only.
 */

import {
  listMemories as listLocalMemories,
  upsertMemory as upsertLocalMemory,
  type LocalMemory,
} from "./local-sqlite.js";

export type MemoryScope = "organization" | "user";

export interface Memory {
  id: string;
  title: string;
  content: string;
  applies_to: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface MemoryInput {
  id?: string;
  title: string;
  content: string;
  applies_to?: string[];
  tags?: string[];
}

export interface RetrieveMemoriesInput {
  specialist?: string | null;
  query?: string;
  limit?: number;
}

function mapMemory(row: LocalMemory): Memory {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    applies_to: row.applies_to,
    tags: row.tags,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listMemories(): Promise<Memory[]> {
  return listLocalMemories().map(mapMemory);
}

export async function upsertMemory(input: MemoryInput): Promise<Memory> {
  return mapMemory(
    upsertLocalMemory({
      id: input.id,
      title: input.title,
      content: input.content,
      tags: input.tags,
      applies_to: input.applies_to,
    }),
  );
}

export async function retrieveMemories(
  input: RetrieveMemoriesInput,
): Promise<Memory[]> {
  const limit = input.limit ?? 10;
  const query = input.query?.trim().toLowerCase();
  let rows = await listMemories();

  if (input.specialist) {
    rows = rows.filter(
      (memory) =>
        memory.applies_to.length === 0 ||
        memory.applies_to.includes(input.specialist!),
    );
  }

  if (query) {
    rows = rows.filter((memory) => {
      const haystack = `${memory.title} ${memory.content}`.toLowerCase();
      return haystack.includes(query);
    });
  }

  return rows.slice(0, limit);
}

export function formatMemoriesBlock(memories: Memory[]): string {
  if (!memories.length) return "";
  const lines = memories.map(
    (memory) => `- ${memory.title}: ${memory.content}`,
  );
  return `Standing context:\n${lines.join("\n")}`;
}

export async function deleteMemory(id: string): Promise<boolean> {
  const { getLocalDb } = await import("./local-sqlite.js");
  const result = getLocalDb().prepare("DELETE FROM memories WHERE id = ?").run(id);
  return result.changes > 0;
}

export async function patchMemory(
  id: string,
  patch: Partial<MemoryInput>,
): Promise<Memory | null> {
  const rows = await listMemories();
  const existing = rows.find((row) => row.id === id);
  if (!existing) return null;
  return upsertMemory({
    id,
    title: patch.title ?? existing.title,
    content: patch.content ?? existing.content,
    tags: patch.tags ?? existing.tags,
    applies_to: patch.applies_to ?? existing.applies_to,
  });
}
