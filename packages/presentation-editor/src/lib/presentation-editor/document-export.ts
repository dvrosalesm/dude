import type { DocumentState } from "@dude/presentation-editor/types";
import { baseExportName } from "./document-export-raster";

export type ExportFormat = "pdf" | "html" | "images" | "video" | "video-slides";

export type ExportOption = {
  format: ExportFormat;
  label: string;
  description: string;
  extension: "pdf" | "html" | "zip" | "mp4";
  progressLabel: string;
};

const EXPORT_OPTIONS: ExportOption[] = [
  {
    format: "pdf",
    label: "PDF",
    description: "Best for sharing and printing",
    extension: "pdf",
    progressLabel: "Preparing PDF export...",
  },
  {
    format: "html",
    label: "HTML",
    description: "Interactive, opens in browser",
    extension: "html",
    progressLabel: "Preparing HTML export...",
  },
  {
    format: "images",
    label: "Images",
    description: "PNG per slide as ZIP",
    extension: "zip",
    progressLabel: "Preparing image export...",
  },
  {
    format: "video",
    label: "Video",
    description: "Single MP4 with all slides",
    extension: "mp4",
    progressLabel: "Preparing video export...",
  },
  {
    format: "video-slides",
    label: "Video/Slide",
    description: "One MP4 per slide as ZIP",
    extension: "zip",
    progressLabel: "Preparing slide videos...",
  },
];

export function getExportOptions(doc: DocumentState | null): ExportOption[] {
  return doc ? EXPORT_OPTIONS : [];
}

export function getDefaultExportName(doc: DocumentState, format: ExportFormat): string {
  const base = baseExportName(doc.name);
  if (format === "images") return `${base}-slides.zip`;
  if (format === "video") return `${base}.mp4`;
  if (format === "video-slides") return `${base}-slide-videos.zip`;
  return `${base}.${format}`;
}

export type ExportProgress = {
  /** 0–1 */
  percent: number;
  /** e.g. "Rendering slide 3 of 10…" */
  label: string;
};

export interface ExportOptions {
  onProgress?: (p: ExportProgress) => void;
  secondsPerSlide?: number;
  slideDurationsSeconds?: number[];
}

export async function runExport(
  doc: DocumentState,
  format: ExportFormat,
  filename?: string,
  onProgressOrOptions?: ((p: ExportProgress) => void) | ExportOptions,
): Promise<void> {
  const opts: ExportOptions = typeof onProgressOrOptions === "function"
    ? { onProgress: onProgressOrOptions }
    : onProgressOrOptions ?? {};
  const { onProgress } = opts;

  if (format === "pdf") {
    const { printSlidesAsPdf } = await import("./document-export-pdf");
    await printSlidesAsPdf(doc, filename, onProgress);
    return;
  }

  if (format === "images") {
    const { exportSlidesAsImages } = await import("./document-export-images");
    await exportSlidesAsImages(doc, filename, onProgress);
    return;
  }

  if (format === "video" || format === "video-slides") {
    const { exportPresentationAsVideo } = await import("./document-export-video");
    await exportPresentationAsVideo(doc, format, filename, opts);
    return;
  }

  const { exportPresentationAsHtml } = await import("./document-export-html");
  await exportPresentationAsHtml(doc, filename);
}
