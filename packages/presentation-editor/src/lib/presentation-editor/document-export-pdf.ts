import type { DocumentState, PptxContent } from "@dude/presentation-editor/types";
import { baseExportName, computeRenderDimensions, getSlideDimensions, renderSlideToCanvas } from "./document-export-raster";

export async function printSlidesAsPdf(
  doc: DocumentState,
  filename?: string,
  onProgress?: (p: { percent: number; label: string }) => void,
): Promise<void> {
  const content = doc.content as PptxContent;
  const slides = content.slides || [];
  if (slides.length === 0) return;

  const dims = getSlideDimensions(content);
  const { renderWidth, renderHeight } = computeRenderDimensions(dims);
  const { jsPDF } = await import("jspdf");

  const pdf = new jsPDF({
    orientation: dims.width >= dims.height ? "landscape" : "portrait",
    unit: "px",
    format: [renderWidth, renderHeight],
    hotfixes: ["px_scaling"],
  });

  for (let index = 0; index < slides.length; index += 1) {
    if (index > 0) {
      pdf.addPage([renderWidth, renderHeight], dims.width >= dims.height ? "landscape" : "portrait");
    }

    onProgress?.({
      percent: index / slides.length,
      label: `Rendering slide ${index + 1} of ${slides.length}...`,
    });

    const canvas = await renderSlideToCanvas(slides[index], dims, renderWidth, renderHeight);
    const imageData = canvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(imageData, "JPEG", 0, 0, renderWidth, renderHeight);
  }

  onProgress?.({ percent: 1, label: "Saving PDF..." });
  const base = filename?.trim().replace(/\.pdf$/i, "") || baseExportName(doc.name);
  pdf.save(`${base}.pdf`);
}
