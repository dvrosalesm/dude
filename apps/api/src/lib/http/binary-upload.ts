/**
 * Raw-binary single-file upload protocol.
 *
 * Why this exists: multipart/form-data bodies are corrupted by something in
 * our prod proxy stack (Caddy + nginx-ingress on Azure VM) — see the
 * `[chat-images] missing_file` incident. The body arrives with a
 * Content-Length / actual-size mismatch and the multipart envelope mangled.
 * Sending the file as the raw HTTP body bypasses multipart parsing entirely,
 * avoids the ~33% bandwidth tax of base64-in-JSON, and streams cleanly.
 *
 * Wire format:
 *   POST /your/route
 *   Content-Type: <file mime, e.g. image/png or application/pdf>
 *   X-File-Name: <URI-encoded original filename>
 *   <raw bytes of file>
 */

export type BinaryUploadFile = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  size: number;
};

const FILE_NAME_HEADER = "x-file-name";

/**
 * Server: extract a binary-upload file from a Request, or return null if the
 * request isn't a binary upload (caller should fall through to multipart /
 * JSON / etc.).
 *
 * Recognized when Content-Type is set and is NOT `application/json` and NOT
 * `multipart/form-data`. The filename comes from the `X-File-Name` header
 * (URI-encoded), or is generated from the mime type if the header is absent.
 */
export async function getBinaryFileFromRequest(
  request: Request,
): Promise<BinaryUploadFile | null> {
  const contentType = (request.headers.get("content-type") || "").trim();
  if (!contentType) return null;
  const lower = contentType.toLowerCase();
  if (lower.startsWith("application/json")) return null;
  if (lower.startsWith("multipart/form-data")) return null;

  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.length === 0) return null;

  // Diagnostic: if the client sent X-Content-SHA256, verify the body wasn't
  // mangled in transit. Logs both checksums and the first bytes so we can
  // tell whether garbage was sent or garbage arrived.
  const expectedChecksum = request.headers.get("x-content-sha256");
  if (expectedChecksum) {
    const { createHash } = await import("crypto");
    const actualChecksum = createHash("sha256").update(buffer).digest("hex");
    if (actualChecksum !== expectedChecksum) {
      console.error("[binary-upload] checksum mismatch — body mangled in transit", {
        expected: expectedChecksum,
        actual: actualChecksum,
        receivedSize: buffer.length,
        contentLength: request.headers.get("content-length"),
        firstBytesHex: buffer.subarray(0, 16).toString("hex"),
        contentType,
      });
    } else {
      console.log("[binary-upload] checksum ok", {
        size: buffer.length,
        firstBytesHex: buffer.subarray(0, 16).toString("hex"),
      });
    }
  }

  const rawName = request.headers.get(FILE_NAME_HEADER) || "";
  let fileName = "";
  try {
    fileName = rawName ? decodeURIComponent(rawName) : "";
  } catch {
    fileName = rawName;
  }
  if (!fileName) {
    const ext = contentType.split("/")[1]?.split(";")[0] || "bin";
    fileName = `upload-${Date.now()}.${ext}`;
  }

  return {
    buffer,
    contentType: lower.split(";")[0].trim(),
    fileName,
    size: buffer.length,
  };
}

/**
 * Read a File into a stable ArrayBuffer.
 *
 * `file.arrayBuffer()` and `body: file` both read lazily from the underlying
 * Blob handle. For Files returned by `ClipboardEvent.clipboardData.items[i]
 * .getAsFile()` in Chrome, that handle can be stale by the time the read
 * happens — you get a Content-Length-sized chunk of *garbage* (random-looking
 * bytes that aren't a valid image) instead of the actual image data.
 *
 * `FileReader.readAsDataURL` is the only Blob-read API that has historically
 * survived this Chromium quirk reliably, so we go through it and decode the
 * base64 back to bytes ourselves. The base64 round-trip is purely in-memory
 * client-side; we still send raw binary over the wire (no inflation).
 */
async function readFileBytesStable(file: File): Promise<ArrayBuffer> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FileReader returned non-string result"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) throw new Error("Invalid data URL");
  const base64 = dataUrl.slice(commaIdx + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Upload a File via the local presign endpoint.
 *
 * Two-step flow:
 *   1. POST `presignEndpoint` with { mimeType, size } → server returns
 *      a writable upload URL and a readable file URL.
 *   2. PUT the file bytes to that upload URL.
 */
export async function uploadFileViaPresign(
  presignEndpoint: string,
  file: File,
): Promise<{ url: string; key: string }> {
  const buffer = await readFileBytesStable(file);
  const mimeType = file.type || "application/octet-stream";

  const presignRes = await fetch(presignEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mimeType,
      size: buffer.byteLength,
      fileName: file.name || "",
    }),
  });
  const presign = (await presignRes.json().catch(() => null)) as
    | { uploadUrl?: string; downloadUrl?: string; key?: string; message?: string; error?: string }
    | null;
  if (!presignRes.ok || !presign?.uploadUrl || !presign?.downloadUrl) {
    throw new Error(
      presign?.message || presign?.error || `Could not get upload URL (${presignRes.status})`,
    );
  }

  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      [FILE_NAME_HEADER]: encodeURIComponent(file.name || ""),
    },
    body: buffer,
  });
  if (!putRes.ok) {
    throw new Error(`Local upload failed (${putRes.status})`);
  }

  return { url: presign.downloadUrl, key: presign.key ?? "" };
}

/**
 * Client: POST a File as a raw binary body. Returns the parsed JSON response.
 * Throws on non-2xx with the server's `message` field if present.
 */
export async function uploadBinaryFile<T = unknown>(
  url: string,
  file: File,
  options?: {
    extraHeaders?: Record<string, string>;
    signal?: AbortSignal;
  },
): Promise<T> {
  const buffer = await readFileBytesStable(file);
  // Send a sha256 of what we *think* we're uploading so the server can verify
  // bytes weren't mangled in transit. Cheap diagnostic; can be removed once
  // the clipboard-paste bug is closed.
  const checksum = await sha256Hex(buffer);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      [FILE_NAME_HEADER]: encodeURIComponent(file.name || ""),
      "X-Content-SHA256": checksum,
      ...(options?.extraHeaders ?? {}),
    },
    body: buffer,
    signal: options?.signal,
  });

  const data = (await res.json().catch(() => null)) as
    | (T & { message?: string; error?: string })
    | null;

  if (!res.ok) {
    const message =
      data?.message || data?.error || `Upload failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}
