import { httpError } from "../http-error.js";
import {
  listMemories,
  getMemory,
  upsertMemory,
  deleteMemory,
  retrieveMemories,
  type Memory,
  type MemoryScope,
} from "../../lib/memory-store.js";

export async function list(
  orgId: string,
  userId?: string,
  scope?: MemoryScope,
): Promise<{ memories: Memory[] }> {
  const memories = await listMemories(orgId, {
    userId: userId ?? undefined,
    scope,
  });
  return { memories };
}

export async function create(
  orgId: string,
  dto: Record<string, unknown>,
): Promise<Memory> {
  if (!dto?.title || !dto?.content || !dto?.scope) {
    throw httpError("scope, title, content are required", 400);
  }
  if (dto.scope === "user" && !dto.user_id) {
    throw httpError("user_id required for user-scope memory", 400);
  }
  return upsertMemory({
    org_id: orgId,
    scope: dto.scope as MemoryScope,
    user_id: (dto.user_id as string | null) ?? null,
    title: dto.title as string,
    content: dto.content as string,
    applies_to: dto.applies_to as string[] | undefined,
    tags: dto.tags as string[] | undefined,
  });
}

export async function patch(
  orgId: string,
  id: string,
  dto: Record<string, unknown>,
): Promise<Memory> {
  const existing = await getMemory(orgId, id);
  if (!existing) {
    throw httpError("Memory not found", 404);
  }
  return upsertMemory({
    id,
    org_id: orgId,
    scope: (dto.scope as MemoryScope) ?? existing.scope,
    user_id: (dto.user_id as string | null) ?? existing.user_id,
    title: (dto.title as string) ?? existing.title,
    content: (dto.content as string) ?? existing.content,
    applies_to: (dto.applies_to as string[]) ?? existing.applies_to,
    tags: (dto.tags as string[]) ?? existing.tags,
  });
}

export async function remove(
  orgId: string,
  id: string,
): Promise<{ deleted: boolean }> {
  const deleted = await deleteMemory(orgId, id);
  if (!deleted) {
    throw httpError("Memory not found", 404);
  }
  return { deleted };
}

export async function retrieve(
  orgId: string,
  body: {
    userId?: string;
    specialist?: string;
    query?: string;
    limit?: number;
  },
): Promise<{ memories: Memory[] }> {
  const memories = await retrieveMemories({
    orgId,
    userId: body?.userId ?? null,
    subagent: body?.subagent ?? null,
    query: body?.query,
    limit: body?.limit,
  });
  return { memories };
}
