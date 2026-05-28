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

export function SourceStep({
  ingestion,
  onSpreadsheetContinue,
  selected,
}: {
  ingestion: UseDataIngestionReturn;
  onSpreadsheetContinue: () => void;
  selected: IngestSourceKind | null;
}) {
  const isSelected = selected !== null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">
          {"Choose a source"}
        </h4>
        <p className="text-xs text-muted-foreground">
          {"Pick the kind of file you're bringing in."}
        </p>
      </div>
      <button
        type="button"
        onClick={onSpreadsheetContinue}
        className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
          isSelected
            ? "border-foreground bg-muted/60"
            : "border-border/50 bg-card hover:border-muted-foreground/50"
        }`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">
            {"CSV or Excel"}
          </p>
          <p className="text-xs text-muted-foreground">
            {"A .csv or .xlsx file — we'll detect the format from the extension."}
          </p>
        </div>
      </button>
      <DirectDatabaseCard ingestion={ingestion} />
    </div>
  );
}

export function DirectDatabaseCard({ ingestion }: { ingestion: UseDataIngestionReturn }) {
  const active = ingestion.activeDirectDatabase;

  return (
    <div className="space-y-4 rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
          <Database className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {"Direct database"}
          </p>
          <p className="text-xs text-muted-foreground">
            {"Connect a live Postgres database and let the analyst query it directly."}
          </p>
          {active && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[10px] font-normal">
                {active.provider}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {active.name}
                {active.schema ? ` · ${active.schema}` : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={"Connection name"}>
          <Input
            value={ingestion.databaseName}
            onChange={(event) => ingestion.setDatabaseName(event.target.value)}
            placeholder={"e.g. Production analytics"}
            className="h-10 bg-card border border-border/50 shadow-sm rounded-lg"
          />
        </Field>
        <Field label={"Schema"}>
          <Input
            value={ingestion.databaseSchemaName}
            onChange={(event) => ingestion.setDatabaseSchemaName(event.target.value)}
            placeholder={"public"}
            className="h-10 bg-card border border-border/50 shadow-sm rounded-lg"
          />
        </Field>
      </div>

      <Field label={"Postgres connection string"}>
        <Input
          value={ingestion.databaseConnectionString}
          onChange={(event) => ingestion.setDatabaseConnectionString(event.target.value)}
          placeholder={"postgres://user:password@host:5432/database"}
          type="password"
          className="h-10 bg-card border border-border/50 shadow-sm rounded-lg"
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {"Use SSL"}
          </span>
          <Switch checked={ingestion.databaseSsl} onCheckedChange={ingestion.setDatabaseSsl} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={ingestion.databaseTesting || ingestion.databaseSaving}
            onClick={() => void ingestion.handleTestDirectDatabase()}
          >
            {ingestion.databaseTesting
              ? "Loading..."
              : "Test"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={ingestion.databaseSaving || ingestion.databaseTesting}
            onClick={() => void ingestion.handleSaveDirectDatabase()}
          >
            {ingestion.databaseSaving
              ? "Loading..."
              : "Connect"}
          </Button>
        </div>
      </div>

      {ingestion.databaseError && (
        <p className="text-xs text-destructive">{ingestion.databaseError}</p>
      )}
      {ingestion.databaseSuccess && (
        <p className="text-xs text-emerald-600">{ingestion.databaseSuccess}</p>
      )}
    </div>
  );
}


