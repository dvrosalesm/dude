import type { LocalStoredFile } from "@dude/client-types";

import { LocalWorkspaceApiError } from "./errors";
import { chatRuntime } from "./shared";

type LocalUpload = Pick<
  LocalStoredFile,
  "id" | "fileName" | "fileType" | "size" | "text" | "bytesBase64" | "dataUrl"
>;

const localUploads = new Map<string, LocalUpload>();

export type UploadBody = {
  fileName?: string;
  fileType?: string;
  size?: number;
  text?: string;
  bytesBase64?: string;
  dataUrl?: string;
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function isTextFile(fileName: string, contentType: string) {
  const lowerName = fileName.toLowerCase();
  const lowerType = contentType.toLowerCase();
  return lowerName.endsWith(".csv") || lowerType.includes("csv") || lowerType.startsWith("text/");
}

export function localUploadUrl(uploadKey: string) {
  return `local://${encodeURIComponent(uploadKey)}`;
}

export function localUploadKeyFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "local:") return "";
    return decodeURIComponent(parsed.hostname || parsed.pathname.replace(/^\/+/, ""));
  } catch {
    return "";
  }
}

async function rememberLocalUpload(upload: LocalUpload, source: string) {
  localUploads.set(upload.id, upload);
  await chatRuntime.saveFile({
    ...upload,
    source,
  });
  return upload;
}

export async function getLocalUpload(uploadKey: string) {
  return localUploads.get(uploadKey) ?? (await chatRuntime.getFile(uploadKey));
}

export async function uploadBodyFromFile(file: File): Promise<UploadBody> {
  const buffer = await file.arrayBuffer();
  const fileType = file.type || "application/octet-stream";
  const bytesBase64 = arrayBufferToBase64(buffer);
  return {
    fileName: file.name,
    fileType,
    size: file.size,
    text: isTextFile(file.name, fileType) ? new TextDecoder().decode(buffer) : undefined,
    bytesBase64,
    dataUrl: `data:${fileType};base64,${bytesBase64}`,
  };
}

export async function putLocalUpload(uploadKey: string, body: UploadBody) {
  const fileType = typeof body.fileType === "string" ? body.fileType : "application/octet-stream";
  const upload = await rememberLocalUpload(
    {
      id: uploadKey,
      fileName: typeof body.fileName === "string" ? body.fileName : uploadKey,
      fileType,
      size: typeof body.size === "number" ? body.size : 0,
      text: typeof body.text === "string" ? body.text : undefined,
      bytesBase64: typeof body.bytesBase64 === "string" ? body.bytesBase64 : undefined,
      dataUrl:
        typeof body.dataUrl === "string"
          ? body.dataUrl
          : typeof body.bytesBase64 === "string"
            ? `data:${fileType};base64,${body.bytesBase64}`
            : undefined,
    },
    "local-protocol",
  );

  return {
    ok: true,
    local: true,
    key: upload.id,
    uploadKey: upload.id,
    downloadUrl: localUploadUrl(upload.id),
  };
}

export async function readLocalUpload(uploadKey: string) {
  const upload = await getLocalUpload(uploadKey);
  if (!upload) {
    throw new LocalWorkspaceApiError("Local file not found", 404);
  }
  if (upload.bytesBase64) {
    return {
      upload,
      buffer: base64ToArrayBuffer(upload.bytesBase64),
    };
  }
  return { upload, buffer: null };
}

export async function presignChatImage(
  fileOrBody:
    | File
    | {
        fileName?: string;
        mimeType?: string;
        size?: number;
      } = {},
): Promise<string> {
  if (fileOrBody instanceof File) {
    const body = await uploadBodyFromFile(fileOrBody);
    const key = `local-upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await putLocalUpload(key, body);
    return localUploadUrl(key);
  }

  const key = `local-upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return localUploadUrl(key);
}

export function forgetLocalUpload(uploadKey: string) {
  localUploads.delete(uploadKey);
}

export async function storeUploadFromBody(
  body: UploadBody,
  source: string,
  uploadKey = `local-upload-${Date.now()}-${Math.random().toString(16).slice(2)}`,
) {
  await rememberLocalUpload(
    {
      id: uploadKey,
      fileName: typeof body.fileName === "string" ? body.fileName : "Local upload",
      fileType: typeof body.fileType === "string" ? body.fileType : "application/octet-stream",
      size: typeof body.size === "number" ? body.size : 0,
      text: typeof body.text === "string" ? body.text : undefined,
      bytesBase64: typeof body.bytesBase64 === "string" ? body.bytesBase64 : undefined,
      dataUrl: typeof body.dataUrl === "string" ? body.dataUrl : undefined,
    },
    source,
  );
  return {
    uploadKey,
    key: uploadKey,
    uploadUrl: localUploadUrl(uploadKey),
    downloadUrl: localUploadUrl(uploadKey),
    local: true,
  };
}
