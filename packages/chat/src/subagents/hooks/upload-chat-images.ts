import { presignChatImage } from "@dude/workspaces";
import type { ChatImageAttachment } from "../types";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_ATTACHMENTS = 4;
type AttachmentSource = "picker" | "clipboard";

const ALLOWED_DOC_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const ALLOWED_DOC_EXTENSIONS = new Set([
  "pdf", "txt", "csv", "md", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
]);

const FALLBACK_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  md: "text/markdown",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function getFileExtension(file: File) {
  return file.name?.split(".").pop()?.toLowerCase() || "";
}

function isAllowedDocFile(file: File) {
  if (file.type && ALLOWED_DOC_MIME_TYPES.has(file.type)) return true;
  // Browsers don't always set type for office docs (especially via picker on some OSes)
  const ext = getFileExtension(file);
  return Boolean(ext && ALLOWED_DOC_EXTENSIONS.has(ext));
}

function getUploadFileName(file: File) {
  if (file.name?.trim()) return file.name;
  if (file.type === "application/pdf") return `attachment-${Date.now()}.pdf`;

  const extension = file.type.startsWith("image/")
    ? file.type.split("/")[1] === "svg+xml"
      ? "svg"
      : file.type.split("/")[1] || "png"
    : file.type === "text/plain"
      ? "txt"
      : file.type === "text/csv"
        ? "csv"
        : file.type === "text/markdown"
          ? "md"
          : "bin";

  return `clipboard-${Date.now()}.${extension}`;
}

function normalizeUploadFile(file: File) {
  const ext = getFileExtension(file);
  const mimeType =
    file.type ||
    FALLBACK_MIME_BY_EXTENSION[ext] ||
    (ext ? "application/octet-stream" : "image/png");
  const fileName = getUploadFileName(file);

  return new File([file], fileName, {
    type: mimeType,
    lastModified: file.lastModified || Date.now(),
  });
}

export async function uploadChatImage(file: File): Promise<string> {
  const normalizedFile = normalizeUploadFile(file);
  return presignChatImage(normalizedFile);
}

/**
 * Attach images with instant local preview + background upload.
 *
 * 1. Creates placeholder attachments immediately (local blob: preview + uploading flag)
 * 2. Adds them to state so the UI shows thumbnails with a spinner right away
 * 3. Uploads in parallel, updating each placeholder with the local URL when done
 */
export async function attachAndUploadImages(
  files: File[],
  currentCount: number,
  setAttachments: React.Dispatch<React.SetStateAction<ChatImageAttachment[]>>,
  setError: (msg: string) => void,
  options?: { acceptPdf?: boolean; source?: AttachmentSource },
) {
  if (!files.length) return;
  const remaining = Math.max(0, MAX_ATTACHMENTS - currentCount);
  if (remaining <= 0) {
    setError("You can attach up to 4 files per message.");
    return;
  }

  const accepted = files
    .map((file) =>
      file.type.startsWith("image/") ? normalizeUploadFile(file) : file,
    )
    .filter((f) =>
      f.type.startsWith("image/") ||
      (options?.acceptPdf && isAllowedDocFile(f)),
    )
    .slice(0, remaining);
  if (!accepted.length) {
    setError(
      options?.acceptPdf
        ? "Unsupported file type. Try images, PDFs, or office documents."
        : "Only image files are supported.",
    );
    return;
  }

  // Create placeholders with instant local preview
  const placeholders: ChatImageAttachment[] = [];
  for (const file of accepted) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(`"${file.name}" exceeds 8MB.`);
      continue;
    }
    const isImg = file.type.startsWith("image/");
    placeholders.push({
      id: crypto.randomUUID(),
      name: getUploadFileName(file),
      mimeType: file.type || (isImg ? "image/*" : "application/octet-stream"),
      dataUrl: isImg
        ? URL.createObjectURL(file)
        : "placeholder",
      uploading: true,
    });
  }
  if (!placeholders.length) return;

  // Add placeholders to state immediately
  setAttachments((prev) => [...prev, ...placeholders].slice(0, MAX_ATTACHMENTS));

  // Upload each in parallel, update placeholder when done
  await Promise.all(
    placeholders.map(async (placeholder, i) => {
      const file = accepted[i];
      try {
        const url = await uploadChatImage(file);
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === placeholder.id
              ? { ...a, dataUrl: url, uploading: false }
              : a,
          ),
        );
        if (placeholder.dataUrl.startsWith("blob:")) {
          URL.revokeObjectURL(placeholder.dataUrl);
        }
      } catch {
        setAttachments((prev) => prev.filter((a) => a.id !== placeholder.id));
        setError(`Could not upload "${file.name}".`);
      }
    }),
  );
}
