"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@dude/ui/components/button";
import { ALL_STEPS, type IngestStep, type UseDataIngestionReturn } from "../hooks/use-data-ingestion";
import { stepIndex } from "./ingestion-shared";

const STEP_META: Record<IngestStep, { title: string; subtitle: string }> = {
  source: { title: "Source", subtitle: "Choose where the data comes from" },
  upload: { title: "Upload", subtitle: "Drop the file" },
  configure: { title: "Configure", subtitle: "Preview, types, rename" },
  import: { title: "Import", subtitle: "Confirm and run" },
};

export function Stepper({ current }: { current: IngestStep }) {
  const currentIndex = stepIndex(current);

  return (
    <div className="grid gap-3 rounded-2xl border border-border/50 bg-card p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      {ALL_STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isActive = index === currentIndex;
        return (
          <div
            key={step}
            className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
              isActive
                ? "bg-muted/60"
                : isCompleted
                  ? "bg-transparent"
                  : "bg-transparent"
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                isCompleted
                  ? "bg-foreground text-background"
                  : isActive
                    ? "bg-foreground/10 text-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">
                  {STEP_META[step].title}
                </p>
                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {STEP_META[step].subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StepperNav({
  ingestion,
  currentIndex,
}: {
  ingestion: UseDataIngestionReturn;
  currentIndex: number;
}) {
  if (ingestion.ingestStep === "source") return null;

  const previousStep = ALL_STEPS[currentIndex - 1];

  function handleBack() {
    if (previousStep) {
      if (previousStep === "upload") {
        ingestion.handleReplaceFile();
      } else {
        ingestion.goToStep(previousStep);
      }
    }
  }

  const nextLabel =
    ingestion.ingestStep === "configure"
      ? "Review & import"
      : ingestion.ingestStep === "import"
        ? "Start import"
        : null;

  function handleNext() {
    if (ingestion.ingestStep === "configure") {
      ingestion.goToStep("import");
    } else if (ingestion.ingestStep === "import") {
      void ingestion.handleImport();
    }
  }

  const nextDisabled =
    ingestion.ingestStep === "configure"
      ? !ingestion.tableName.trim() || !ingestion.parsedFile
      : ingestion.ingestStep === "import"
        ? !ingestion.canImport
        : true;

  return (
    <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-4">
      <Button type="button" variant="outline" onClick={handleBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {"Back"}
      </Button>
      {nextLabel && ingestion.ingestStep === "import" ? (
        <button
          type="button"
          onClick={handleNext}
          disabled={nextDisabled}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all active:translate-y-[1px] active:shadow-none disabled:pointer-events-none disabled:opacity-50"
          style={{
            background: "linear-gradient(180deg, #E7C59A, #E7C59A)",
            boxShadow: "0 2px 0 0 #E7C59A, 0 4px 10px rgba(231,197,154,0.25)",
          }}
        >
          {ingestion.ingesting
            ? "Importing..."
            : nextLabel}
          {!ingestion.ingesting && <ArrowRight className="h-4 w-4" />}
        </button>
      ) : (
        nextLabel && (
          <Button type="button" onClick={handleNext} disabled={nextDisabled}>
            {nextLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )
      )}
    </div>
  );
}
