/**
 * Request-scoped DB path — avoids mutating process.env for concurrent internal API calls.
 */

import { AsyncLocalStorage } from "node:async_hooks";

const dbPathStore = new AsyncLocalStorage<string>();

export function getRequestDbPath(): string | undefined {
  return dbPathStore.getStore();
}

export async function withRequestDbPath<T>(
  dbPath: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!dbPath?.trim()) return fn();
  return dbPathStore.run(dbPath.trim(), fn);
}
