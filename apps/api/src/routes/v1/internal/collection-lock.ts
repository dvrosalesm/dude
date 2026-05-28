const collectionMutex = new Map<string, Promise<void>>();
const collectionQueueDepth = new Map<string, number>();
const COLLECTION_QUEUE_WARN_THRESHOLD = 4;

export async function withCollectionLock<T>(
  workspaceId: string,
  collection: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = `${workspaceId}:${collection}`;
  const prev = collectionMutex.get(key) ?? Promise.resolve();
  let release!: () => void;
  const ours = new Promise<void>((r) => {
    release = r;
  });
  collectionMutex.set(key, ours);

  const depth = (collectionQueueDepth.get(key) ?? 0) + 1;
  collectionQueueDepth.set(key, depth);
  if (depth >= COLLECTION_QUEUE_WARN_THRESHOLD) {
    console.warn(
      `[collection-lock] WARN: ${depth} parallel ${collection} writes queued for ${workspaceId} — agent is likely fanning out workspace_save instead of batching`,
    );
  }

  try {
    await prev.catch(() => undefined);
    return await fn();
  } finally {
    release();
    if (collectionMutex.get(key) === ours) collectionMutex.delete(key);
    const next = (collectionQueueDepth.get(key) ?? 1) - 1;
    if (next <= 0) collectionQueueDepth.delete(key);
    else collectionQueueDepth.set(key, next);
  }
}
