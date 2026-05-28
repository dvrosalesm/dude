"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Download, FileText, Film, Globe, Image, Video } from "lucide-react";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import { useDocumentEditorStore } from "@dude/presentation-editor/store";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@dude/ui/components/dialog";
import { Button } from "@dude/ui/components/button";
import { Checkbox } from "@dude/ui/components/checkbox";
import { Input } from "@dude/ui/components/input";
import { ScrollArea } from "@dude/ui/components/scroll-area";
import { useToast } from "@dude/ui/hooks/use-toast";
import {
  getExportOptions,
  getDefaultExportName,
  runExport,
  type ExportProgress,
  type ExportFormat,
} from "@dude/presentation-editor/lib/document-export";
import type { PptxContent } from "@dude/presentation-editor/types";

type ExportStatus = "idle" | "exporting" | "error";

const FORMAT_ICONS: Record<ExportFormat, typeof FileText> = {
  pdf: FileText,
  html: Globe,
  images: Image,
  video: Video,
  "video-slides": Film,
};

const DEFAULT_SECONDS_PER_SLIDE = 5;

function clampDuration(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_SECONDS_PER_SLIDE;
  return Math.max(1, Math.min(30, value));
}

export function DocumentExportMenu() {
  const document = useDocumentEditorStore((s) => s.document);
  const options = getExportOptions(document);
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [secondsPerSlide, setSecondsPerSlide] = useState(DEFAULT_SECONDS_PER_SLIDE);
  const [useCustomSlideDurations, setUseCustomSlideDurations] = useState(false);
  const [slideDurations, setSlideDurations] = useState<number[]>([]);

  const openModal = useCallback(() => {
    if (!document) return;
    setExportFormat("pdf");
    setFileName(getDefaultExportName(document, "pdf"));
    setStatus("idle");
    setProgress(null);
    setErrorMessage(null);
    setSecondsPerSlide(DEFAULT_SECONDS_PER_SLIDE);
    setUseCustomSlideDurations(false);
    const slideCount = ((document.content as PptxContent).slides?.length ?? 0);
    setSlideDurations(Array.from({ length: slideCount }, () => DEFAULT_SECONDS_PER_SLIDE));
    setIsOpen(true);
  }, [document]);

  const selectedOption = useMemo(
    () => options.find((option) => option.format === exportFormat) ?? options[0],
    [exportFormat, options],
  );
  const content = document?.content as PptxContent | undefined;
  const slideCount = content?.slides?.length ?? 0;
  const effectiveSlideDurations = useMemo(() => {
    if (!useCustomSlideDurations) {
      return Array.from({ length: slideCount }, () => clampDuration(secondsPerSlide));
    }
    return Array.from({ length: slideCount }, (_, index) =>
      clampDuration(slideDurations[index] ?? secondsPerSlide),
    );
  }, [secondsPerSlide, slideCount, slideDurations, useCustomSlideDurations]);

  const selectFormat = useCallback((format: ExportFormat) => {
    if (status === "exporting") return;
    setExportFormat(format);
    setProgress(null);
    setErrorMessage(null);
    setStatus("idle");
    if (document) {
      setFileName(getDefaultExportName(document, format));
    }
  }, [status, document]);

  const handleExport = async () => {
    if (!document || !selectedOption || !fileName.trim()) return;
    setStatus("exporting");
    setErrorMessage(null);
    setProgress({ percent: 0, label: selectedOption.progressLabel });

    try {
      await runExport(document, exportFormat, fileName, {
        onProgress: (p) => setProgress(p),
        secondsPerSlide,
        slideDurationsSeconds: useCustomSlideDurations
          ? slideDurations.map((duration) => clampDuration(duration))
          : undefined,
      });
      setStatus("idle");
      setIsOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      setStatus("error");
      setProgress(null);
      setErrorMessage(message);
      toast({
        title: "Export error",
        description: message,
        variant: "destructive",
      });
    }
  };

  if (!document || options.length === 0) {
    return (
      <Button variant="ghost" size="icon" disabled className="h-8 w-8" aria-label={"Download document"}>
        <Download className="h-4 w-4" />
      </Button>
    );
  }

  const exporting = status === "exporting";
  const progressPercent = progress ? Math.round(progress.percent * 100) : 0;
  const isVideoFormat = exportFormat === "video" || exportFormat === "video-slides";
  const statusLabel = exporting
    ? progress?.label || selectedOption?.progressLabel || "Preparing export..."
    : status === "error"
      ? errorMessage || "Export failed."
      : null;
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={openModal}
        aria-label={"Download in another format"}
      >
        <Download className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => { if (!exporting) setIsOpen(open); }}>
        <DialogContent
          className="max-w-lg gap-0 overflow-hidden rounded-2xl border border-border bg-background p-0 shadow !flex !flex-col"
          style={{ height: isVideoFormat ? 520 : 320 }}
          onPointerDownOutside={(e) => { if (exporting) e.preventDefault(); }}
        >
          <DialogTitle className="flex h-[72px] items-center border-b border-border px-6 pr-14 text-left">
            <div className="flex min-w-0 items-center gap-3">
              <p className="text-base font-semibold text-foreground">Export</p>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {slideCount} slide{slideCount !== 1 ? "s" : ""}
              </span>
            </div>
          </DialogTitle>

          <div className="flex min-h-0 flex-1 flex-col">
            <ScrollArea className="min-h-0 flex-1">
              <div className="px-6 pt-5">
                <div className="grid min-h-[52px] grid-cols-2 gap-2 sm:grid-cols-3">
                  {options.map((option) => {
                    const { format, label } = option;
                    const Icon = FORMAT_ICONS[format];
                    const selected = format === exportFormat;

                    return (
                      <button
                        key={format}
                        type="button"
                        disabled={exporting}
                        onClick={() => selectFormat(format)}
                        className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                          selected
                            ? "border border-[#E7C59A] bg-muted/50 shadow-sm text-foreground"
                            : "border border-border/50 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        } ${exporting ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${selected ? "text-[#E7C59A]" : "text-muted-foreground"}`} />
                        <span>{label}</span>
                        {selected && <Check className="h-3.5 w-3.5 text-[#E7C59A]" />}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 h-[72px] space-y-2">
                  <label className="text-xs text-muted-foreground">File name</label>
                  <Input
                    placeholder="File name"
                    value={fileName}
                    disabled={exporting}
                    onChange={(e) => setFileName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && fileName.trim() && !exporting) {
                        e.preventDefault();
                        void handleExport();
                      }
                    }}
                    className="h-10 rounded-lg bg-card border border-border/50 shadow-sm"
                  />
                </div>

                {isVideoFormat && (
                  <div className="mt-4 rounded-xl border border-border/50 bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Slide timing</p>
                        <p className="text-xs text-muted-foreground">Default is 5 seconds per slide.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Default</span>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={secondsPerSlide}
                          disabled={exporting}
                          onChange={(e) => {
                            const next = clampDuration(parseInt(e.target.value, 10));
                            setSecondsPerSlide(next);
                            if (!useCustomSlideDurations) {
                              setSlideDurations(Array.from({ length: slideCount }, () => next));
                            }
                          }}
                          className="h-9 w-20 rounded-lg bg-card border border-border/50 text-sm shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Customize per slide</p>
                        <p className="text-xs text-muted-foreground">Override timing for individual slides.</p>
                      </div>
                      <Checkbox
                        checked={useCustomSlideDurations}
                        disabled={exporting}
                        onCheckedChange={(checked) => {
                          const enabled = checked === true;
                          setUseCustomSlideDurations(enabled);
                          if (enabled) {
                            setSlideDurations(Array.from({ length: slideCount }, (_, index) => effectiveSlideDurations[index]));
                          }
                        }}
                      />
                    </div>

                    <div className="mt-4 h-[140px] rounded-lg border border-border/50 bg-background">
                      {useCustomSlideDurations ? (
                        <ScrollArea className="h-full">
                          <div className="space-y-2 p-3">
                            {effectiveSlideDurations.map((duration, index) => (
                              <div key={index} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
                                <div>
                                  <p className="text-sm font-medium text-foreground">Slide {index + 1}</p>
                                  <p className="text-[11px] text-muted-foreground">Custom duration</p>
                                </div>
                                <Input
                                  type="number"
                                  min={1}
                                  max={30}
                                  value={duration}
                                  disabled={exporting}
                                  onChange={(e) => {
                                    const next = clampDuration(parseInt(e.target.value, 10));
                                    setSlideDurations((current) => {
                                      const updated = Array.from({ length: slideCount }, (_, currentIndex) => current[currentIndex] ?? effectiveSlideDurations[currentIndex]);
                                      updated[index] = next;
                                      return updated;
                                    });
                                  }}
                                  className="h-8 w-20 rounded-lg bg-card border border-border/50 text-sm shadow-sm"
                                />
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center px-4 text-center text-muted-foreground">
                          <p className="text-sm font-medium">All slides will use {clampDuration(secondsPerSlide)} seconds.</p>
                          <p className="mt-1 text-xs">Enable custom timing if you want to control each slide separately.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!exporting && status === "error" && statusLabel && (
                  <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {statusLabel}
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t border-border px-6 pb-6 pt-4">
              {exporting ? (
                <div className="relative h-9 w-full overflow-hidden rounded-lg border border-border/50 bg-muted/30">
                  <div
                    className="absolute inset-y-0 left-0 rounded-lg bg-[#E7C59A]/20 transition-[width] duration-300 ease-out"
                    style={{ width: `${Math.max(progressPercent, 8)}%` }}
                  />
                  <div className="relative z-10 flex h-full items-center justify-between gap-3 px-4">
                    <span className="min-w-0 flex flex-1 items-center gap-2 truncate text-xs font-medium text-foreground">
                      <BrailleSpinner className="text-sm" />
                      <span className="truncate">{statusLabel}</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
                      {progressPercent}%
                    </span>
                  </div>
                </div>
              ) : (
                <Button
                  className="h-9 w-full"
                  size="default"
                  disabled={!fileName.trim()}
                  onClick={() => void handleExport()}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Export {selectedOption?.label || "File"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
