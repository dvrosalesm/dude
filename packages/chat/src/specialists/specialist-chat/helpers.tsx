import {
  Code,
  Database,
  FileText,
  Globe,
  Save,
  Search,
  type LucideIcon,
} from "lucide-react";
import { chatAttachmentPillClassName } from "@dude/ui/design-system";
import { extractJsonSnippet } from "@dude/data-analyst-core/render/utils";
import { isSpecialistCall } from "../specialist-meta";

export function isImageAttachment(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("data:image/")) return true;
  if (url.startsWith("data:")) return false;
  const path = url.split(/[?#]/)[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|heif)$/.test(path);
}

export function attachmentLabel(url: string): string {
  if (isImageAttachment(url)) return "Image attached";
  return "File attached";
}

export function attachmentIndexLabel(
  url: string,
  index: number,
  total: number,
): string {
  const noun = isImageAttachment(url) ? "Image" : "File";
  return `${noun} ${index + 1} of ${total}`;
}

export function AttachedFilePill({
  url,
  label,
}: {
  url: string;
  label: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={chatAttachmentPillClassName()}
      title="Open attached file"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--dude-accent-soft)] shrink-0">
        <FileText className="h-3 w-3 text-muted-foreground" />
      </span>
      <span>{label}</span>
    </a>
  );
}

export function formatMessageContent(content: unknown) {
  if (typeof content === "string") return content;
  if (content && typeof content === "object" && "content" in content) {
    const inner = (content as { content?: unknown }).content;
    if (typeof inner === "string") return inner;
  }
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

export function tryExtractRenderSpec(
  content: unknown,
): Record<string, unknown> | null {
  const text = formatMessageContent(content);
  const parsed = extractJsonSnippet(text);
  if (!parsed) return null;
  if (
    typeof parsed.root === "string" &&
    parsed.elements &&
    typeof parsed.elements === "object"
  ) {
    return parsed;
  }
  return null;
}

export const DEFAULT_TOOL_ICONS: Record<string, LucideIcon> = {
  sql: Database,
  python: Code,
  web_search: Search,
  web_scrape: Globe,
  save_database: Save,
  workspace_save: Save,
  workspace_read: Search,
  edit_document: FileText,
  edit_presentation: FileText,
};

export function defaultArgPreview(
  tool: string,
  args: Record<string, unknown>,
): string {
  if (tool === "sql") return String(args.query || "").slice(0, 120);
  if (tool === "python") return String(args.code || "").split("\n")[0]?.slice(0, 120) || "";
  if (tool === "web_search") return String(args.query || "").slice(0, 120);
  if (tool === "web_scrape") return String(args.url || "").slice(0, 120);
  if (tool === "workspace_save") return String(args.collection || "").slice(0, 120);
  if (tool === "workspace_read") return String(args.collection || "all").slice(0, 120);
  if (isSpecialistCall(tool)) return String(args?.message || "").slice(0, 200);
  if (tool === "edit_document" || tool === "edit_presentation") {
    const edits = args?.edits;
    return Array.isArray(edits)
      ? `${edits.length} edit${edits.length === 1 ? "" : "s"}`
      : "";
  }
  try {
    return JSON.stringify(args ?? {}).slice(0, 120);
  } catch {
    return "";
  }
}
