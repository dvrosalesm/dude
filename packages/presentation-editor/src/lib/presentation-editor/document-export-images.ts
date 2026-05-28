import type { DocumentState, PptxContent } from "@dude/presentation-editor/types";
import { baseExportName, computeRenderDimensions, downloadBlob, getSlideDimensions, renderSlideToCanvas } from "./document-export-raster";

export async function exportSlidesAsImages(
  doc: DocumentState,
  filename?: string,
  onProgress?: (p: { percent: number; label: string }) => void,
): Promise<void> {
  const content = doc.content as PptxContent;
  const slides = content.slides || [];
  if (slides.length === 0) return;

  const dims = getSlideDimensions(content);
  const { renderWidth, renderHeight } = computeRenderDimensions(dims);

  const { default: JSZip } = await import("jszip");

  const zip = new JSZip();
  const base = filename?.trim().replace(/\.zip$/i, "") || `${baseExportName(doc.name)}-slides`;

  for (let index = 0; index < slides.length; index += 1) {
    onProgress?.({
      percent: index / slides.length,
      label: `Rendering slide ${index + 1} of ${slides.length}...`,
    });

    const canvas = await renderSlideToCanvas(slides[index], dims, renderWidth, renderHeight);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("Could not encode slide image."));
      }, "image/png");
    });
    zip.file(`slide-${index + 1}.png`, blob);
  }

  onProgress?.({ percent: 1, label: "Bundling ZIP..." });
  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipBlob, `${base}.zip`);
}
