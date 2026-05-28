import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const BLOB_ROOT = path.join(os.homedir(), ".dude", "blobs");

function safeKey(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return normalized;
}

function blobPath(key: string): string {
  return path.join(BLOB_ROOT, safeKey(key));
}

export async function writeLocalBlob(
  key: string,
  data: Buffer | Uint8Array | string,
): Promise<void> {
  const filePath = blobPath(key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const body =
    typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  await fs.writeFile(filePath, body);
}

export async function readLocalBlob(key: string): Promise<Buffer | null> {
  const filePath = blobPath(key);
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteLocalBlob(key: string): Promise<void> {
  const filePath = blobPath(key);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") throw error;
  }
}

export function localBlobRoot(): string {
  return BLOB_ROOT;
}
