"use client";

import type { ClipboardEvent, DragEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Server,
  Upload,
  Wand2,
} from "lucide-react";
import { Badge } from "@dude/ui/components/badge";
import { Button } from "@dude/ui/components/button";
import { Input } from "@dude/ui/components/input";
import { Progress } from "@dude/ui/components/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dude/ui/components/select";
import { Switch } from "@dude/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dude/ui/components/table";
import {
  ALL_STEPS,
  type IngestStep,
  type UseDataIngestionReturn,
} from "../hooks/use-data-ingestion";
import type { ColumnStat, IngestIssue, IngestSourceKind } from "../utils";

import { stepIndex, formatBytes, sourceExtension } from "./ingestion-shared";

export function UploadStep({
  source,
  onFileSelected,
  onPasteFile,
  onDropFile,
}: {
  source: IngestSourceKind | null;
  onFileSelected: (file: File | null) => void;
  onPasteFile: (event: ClipboardEvent<HTMLDivElement>) => void;
  onDropFile: (event: DragEvent<HTMLDivElement>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounter.current += 1;
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragCounter.current = 0;
      setDragOver(false);
      onDropFile(event);
    },
    [onDropFile],
  );

  const accept = source ? sourceExtension(source) : ".csv,.xlsx";
  const label = source
    ? "Upload your " + source.toUpperCase() + " file"
    : "Drop your file here";

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">{label}</h4>
        <p className="text-xs text-muted-foreground">
          {"Drag in a file or browse to select one from your device."}
        </p>
      </div>
      <div
        className={`group relative rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 ${
          dragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border/50 bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50"
        }`}
        onPaste={onPasteFile}
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => {
            onFileSelected(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
        <div className="flex flex-col items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
              dragOver
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Upload className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {"Drop your file here"}
            </p>
            <p className="text-xs text-muted-foreground">
              {"or paste from clipboard"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-1 rounded-xl border border-border/50 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            {"Browse files"}
          </button>
          <div className="mt-1 flex items-center gap-2">
            {(source === null || source === "csv") && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                .csv
              </Badge>
            )}
            {(source === null || source === "xlsx") && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                .xlsx
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FileMetaCard({ ingestion }: { ingestion: UseDataIngestionReturn }) {
  const file = ingestion.ingestFile;
  const parsed = ingestion.parsedFile;
  if (!file || !parsed) return null;

  const meta =
    parsed.rows.length.toLocaleString() +
    " rows · " +
    parsed.headers.length.toLocaleString() +
    " columns · " +
    formatBytes(file.size) +
    " · " +
    ingestion.encoding +
    ' · delimiter "' +
    (ingestion.source === "csv" ? ingestion.delimiter : "-") +
    '"';

  const iconLabel = ingestion.source === "csv" ? "CSV" : "XLSX";

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-3 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-[11px] font-semibold">
        {iconLabel}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{file.name}</p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={ingestion.handleReplaceFile}
      >
        {"Replace"}
      </Button>
    </div>
  );
}

