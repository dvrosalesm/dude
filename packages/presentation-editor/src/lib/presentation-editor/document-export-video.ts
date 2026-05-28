import type { DocumentState, PptxContent, Slide } from "@dude/presentation-editor/types";
import {
  baseExportName,
  computeRenderDimensions,
  downloadBlob,
  getSlideDimensions,
  renderSlideToCanvas,
} from "./document-export-raster";
import type { ExportFormat, ExportOptions, ExportProgress } from "./document-export";


const DEFAULT_SECONDS_PER_SLIDE = 5;
const FPS = 30;

type VideoSlidePayload = {
  kind: "image" | "html";
  imageDataUrl?: string;
  htmlContent?: string;
  durationSeconds: number;
  index: number;
  summary: string;
};

function clampDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return DEFAULT_SECONDS_PER_SLIDE;
  return Math.max(1, Math.min(30, seconds));
}

function getSlideDurations(
  slideCount: number,
  secondsPerSlide?: number,
  slideDurationsSeconds?: number[],
) {
  const fallback = clampDuration(secondsPerSlide ?? DEFAULT_SECONDS_PER_SLIDE);
  return Array.from({ length: slideCount }, (_, index) =>
    clampDuration(slideDurationsSeconds?.[index] ?? fallback),
  );
}

function summarizeSlide(slide: Slide) {
  const textParts: string[] = [];
  for (const shape of slide.shapes || []) {
    if (shape.hidden) continue;
    if (shape.type === "text") {
      textParts.push(
        shape.paragraphs
          .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
          .join(" ")
          .trim(),
      );
    }
    if (shape.type === "html" && shape.htmlContent) {
      try {
        const doc = new DOMParser().parseFromString(shape.htmlContent, "text/html");
        const headings = Array.from(doc.querySelectorAll("h1, h2, h3"))
          .map((element) => element.textContent?.trim() || "")
          .filter(Boolean);
        const bodyText = doc.body.textContent?.replace(/\s+/g, " ").trim() || "";
        textParts.push(...headings);
        if (bodyText) textParts.push(bodyText);
      } catch {
        // ignore malformed html
      }
    }
  }

  const summary = textParts
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);

  return summary || `Slide ${slide.index + 1}`;
}

function isFullSlideHtmlShape(slide: Slide, dims: NonNullable<PptxContent["slideDimensions"]>) {
  return (slide.shapes || []).find((shape) =>
    !shape.hidden &&
    shape.type === "html" &&
    shape.transform.x === 0 &&
    shape.transform.y === 0 &&
    shape.transform.cx === dims.width &&
    shape.transform.cy === dims.height,
  );
}

async function rasterizeSlides(
  doc: DocumentState,
  onProgress?: (p: ExportProgress) => void,
  secondsPerSlide?: number,
  slideDurationsSeconds?: number[],
): Promise<{ slides: VideoSlidePayload[]; width: number; height: number }> {
  const content = doc.content as PptxContent;
  const slides = content.slides || [];
  const dims = getSlideDimensions(content);
  const { renderWidth, renderHeight } = computeRenderDimensions(dims);
  const durations = getSlideDurations(slides.length, secondsPerSlide, slideDurationsSeconds);

  const payload: VideoSlidePayload[] = [];
  for (let index = 0; index < slides.length; index += 1) {
    onProgress?.({
      percent: (index / Math.max(slides.length, 1)) * 0.45,
      label: `Preparing slide ${index + 1} of ${slides.length}...`,
    });

    const slide = slides[index];
    const htmlShape = isFullSlideHtmlShape(slide, dims);
    if (htmlShape) {
      payload.push({
        kind: "html",
        htmlContent: htmlShape.htmlContent,
        durationSeconds: durations[index],
        index,
        summary: summarizeSlide(slide),
      });
      continue;
    }

    const canvas = await renderSlideToCanvas(slide, dims, renderWidth, renderHeight);
    payload.push({
      kind: "image",
      imageDataUrl: canvas.toDataURL("image/jpeg", 0.94),
      durationSeconds: durations[index],
      index,
      summary: summarizeSlide(slide),
    });
  }

  return { slides: payload, width: renderWidth, height: renderHeight };
}

async function requestVideoExport({
  mode,
  slides,
  width,
  height,
  filename,
  onProgress,
}: {
  mode: Extract<ExportFormat, "video" | "video-slides">;
  slides: VideoSlidePayload[];
  width: number;
  height: number;
  filename: string;
  onProgress?: (p: ExportProgress) => void;
}) {
  void mode;
  void slides;
  void width;
  void height;
  void filename;
  onProgress?.({ percent: 0.5, label: "Video export is not available in local mode." });
  throw new Error("Video export is not available in local mode.");
}

export async function exportPresentationAsVideo(
  doc: DocumentState,
  format: Extract<ExportFormat, "video" | "video-slides">,
  filename?: string,
  options?: ExportOptions,
) {
  const content = doc.content as PptxContent;
  const slides = content.slides || [];
  if (slides.length === 0) return;

  const base = baseExportName(doc.name);
  const resolvedFilename = filename?.trim()
    || (format === "video" ? `${base}.mp4` : `${base}-slide-videos.zip`);

  const { slides: slidePayload, width, height } = await rasterizeSlides(
    doc,
    options?.onProgress,
    options?.secondsPerSlide,
    options?.slideDurationsSeconds,
  );

  options?.onProgress?.({ percent: 0.48, label: "Planning video animations..." });

  await requestVideoExport({
    mode: format,
    slides: slidePayload,
    width,
    height,
    filename: resolvedFilename,
    onProgress: options?.onProgress,
  });
}
