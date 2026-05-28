/**
 * Small download helpers used by the canvas node action columns.
 *
 * `downloadFromUrl` fetches a remote asset and saves it via a synthetic
 * anchor click. The fetch path keeps the suggested filename when the
 * source URL has none of its own (R2 signed URLs in this codebase).
 * If CORS blocks the fetch we fall back to opening the URL in a new tab
 * so the user can save it manually.
 *
 * `downloadAsFile` saves an in-memory string (HTML, JSON, CSS, …) using
 * the same anchor-click trick.
 */

export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    triggerBlobDownload(blob, filename);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

export function downloadAsFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  triggerBlobDownload(blob, filename);
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Best-effort image extension from a URL path. Falls back to "png". */
export function guessImageExtension(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase();
    const m = path.match(/\.(png|jpg|jpeg|webp|gif|svg|avif)$/);
    if (m) return m[1] === "jpeg" ? "jpg" : m[1];
  } catch {
    /* fall through */
  }
  return "png";
}

/** Sluggify a label for use in a filename. */
export function slugifyForFilename(label: string, fallback = "download"): string {
  const cleaned = label
    .trim()
    .toLowerCase()
    .replace(/[^\w\s.-]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}
