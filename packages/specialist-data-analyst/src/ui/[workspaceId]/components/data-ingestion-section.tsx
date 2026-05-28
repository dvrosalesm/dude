"use client";

import { Progress } from "@dude/ui/components/progress";
import {
  ALL_STEPS,
  type UseDataIngestionReturn,
} from "../hooks/use-data-ingestion";
import {
  ConfigureStep,
  ReviewStep,
  SourceStep,
  Stepper,
  StepperNav,
  UploadStep,
} from "./data-ingestion-steps";

type Props = {
  ingestion: UseDataIngestionReturn;
};

export function DataIngestionSection({ ingestion }: Props) {
  const current = ingestion.ingestStep;
  const currentIndex = ALL_STEPS.indexOf(current);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold">
          {"Import data"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {"Bring a file, sheet, query, or database connection into this workspace as a table."}
        </p>
      </div>

      <Stepper current={current} />

      {current === "source" && (
        <SourceStep
          ingestion={ingestion}
          onSpreadsheetContinue={() => ingestion.goToStep("upload")}
          selected={ingestion.source}
        />
      )}

      {current === "upload" && (
        <UploadStep
          source={ingestion.source}
          onFileSelected={(file) => void ingestion.handleFileSelected(file)}
          onPasteFile={ingestion.handlePasteFile}
          onDropFile={ingestion.handleDropFile}
        />
      )}

      {current === "configure" && ingestion.parsedFile && ingestion.ingestFile && (
        <ConfigureStep ingestion={ingestion} />
      )}

      {current === "import" && ingestion.parsedFile && ingestion.ingestFile && (
        <ReviewStep ingestion={ingestion} />
      )}

      {ingestion.ingesting && ingestion.ingestProgress != null && (
        <div className="space-y-2">
          <Progress value={ingestion.ingestProgress} className="h-2" />
          {ingestion.ingestProgressLabel && (
            <p className="text-xs text-muted-foreground">
              {ingestion.ingestProgressLabel}
            </p>
          )}
        </div>
      )}

      {ingestion.ingestError && (
        <p className="text-sm text-destructive">{ingestion.ingestError}</p>
      )}

      {ingestion.ingestSuccess && (
        <p className="text-sm text-emerald-500">{ingestion.ingestSuccess}</p>
      )}

      <StepperNav ingestion={ingestion} currentIndex={currentIndex} />
    </section>
  );
}
