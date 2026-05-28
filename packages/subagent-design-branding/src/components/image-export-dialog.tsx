"use client";

import { useState } from "react";
import { Download, FileImage, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@dude/ui/components/dialog";
import { imageExportDesignBranding } from "@dude/workspaces";

type ExportFormat = "jpg" | "png" | "webp" | "gif";

const EXPORT_FORMATS: Array<{
  value: ExportFormat;
  label: string;
  description: string;
}> = [
  { value: "png", label: "PNG", description: "Best for transparency and clean assets." },
  { value: "jpg", label: "JPG", description: "Small, universal, flattened on white." },
  { value: "webp", label: "WebP", description: "Modern compression with transparency." },
  { value: "gif", label: "GIF", description: "Static GIF export for compatibility." },
];

const FORMAT_EXTENSION: Record<ExportFormat, string> = {
  jpg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
};

type ImageExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  filenameBase: string;
};

export function ImageExportDialog({
  open,
  onOpenChange,
  imageUrl,
  filenameBase,
}: ImageExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("png");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportImage() {
    if (!imageUrl || exporting) return;
    setExporting(true);
    setError(null);
    try {
      const blob = await imageExportDesignBranding({ imageUrl, format: selectedFormat });
      triggerBlobDownload(blob, `${filenameBase}.${FORMAT_EXTENSION[selectedFormat]}`);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export image");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[3000] max-w-md p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Export image</DialogTitle>
        <DialogDescription className="sr-only">
          Choose an image format and export the selected image.
        </DialogDescription>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Export image</div>
            <div className="text-xs text-muted-foreground">Choose the final file format.</div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close export dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="grid gap-2">
            {EXPORT_FORMATS.map((format) => (
              <button
                key={format.value}
                type="button"
                onClick={() => setSelectedFormat(format.value)}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  selectedFormat === format.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                    selectedFormat === format.value
                      ? "bg-background/15 text-background"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <FileImage className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{format.label}</span>
                  <span className="block text-xs opacity-70">{format.description}</span>
                </span>
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => void exportImage()}
            disabled={!imageUrl || exporting}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? "Exporting..." : `Export ${selectedFormat.toUpperCase()}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
