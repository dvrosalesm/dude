"use client";

import { useCallback, useMemo, useState } from "react";
import type { ClipboardEvent, DragEvent } from "react";
import {
  callWorkspaceAction,
  LocalWorkspaceApiError,
  postWorkspaceUploadUrl,
  streamWorkspaceIngest,
} from "@dude/workspaces";
import type { IngestPreview, ParsedFile, Workspace, WorkspaceSchema } from "../types";
import {
  buildPreviewFromFile,
  computeColumnStats,
  detectIssues,
  ensureUniqueIdentifiers,
  normalizeIdentifier,
  parseFile,
  sniffCsvDelimiter,
  type ColumnStat,
  type IngestIssue,
  type IngestSourceKind,
} from "../utils";

export type IngestStep = "source" | "upload" | "configure" | "import";

export const ALL_STEPS: IngestStep[] = [
  "source",
  "upload",
  "configure",
  "import",
];

const DEFAULT_DELIMITER = ",";
const DEFAULT_ENCODING = "UTF-8";

export function useDataIngestion({
  workspace,
  setWorkspace,
  subagentId,
  workspaceId,
}: {
  workspace: Workspace | null;
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace | null>>;
  subagentId: "data-analyst";
  workspaceId: string | undefined;
}) {
  const [ingestStep, setIngestStep] = useState<IngestStep>("source");
  const [source, setSource] = useState<IngestSourceKind | null>(null);
  const [ingestFile, setIngestFile] = useState<File | null>(null);
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [ingestPreview, setIngestPreview] = useState<IngestPreview | null>(null);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [columnStats, setColumnStats] = useState<ColumnStat[]>([]);
  const [issues, setIssues] = useState<IngestIssue[]>([]);
  const [tableName, setTableName] = useState("");
  const [delimiter, setDelimiter] = useState(DEFAULT_DELIMITER);
  const [encoding, setEncoding] = useState(DEFAULT_ENCODING);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [appendToExisting, setAppendToExisting] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestProgress, setIngestProgress] = useState<number | null>(null);
  const [ingestPhase, setIngestPhase] = useState<string>("");
  const [ingestProgressLabel, setIngestProgressLabel] = useState<string>("");
  const [databaseName, setDatabaseName] = useState("");
  const [databaseConnectionString, setDatabaseConnectionString] = useState("");
  const [databaseSchemaName, setDatabaseSchemaName] = useState("");
  const [databaseSsl, setDatabaseSsl] = useState(true);
  const [databaseSaving, setDatabaseSaving] = useState(false);
  const [databaseTesting, setDatabaseTesting] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [databaseSuccess, setDatabaseSuccess] = useState<string | null>(null);

  const tableOptions = useMemo(
    () => Object.keys(workspace?.configurations?.schema?.tables ?? {}),
    [workspace?.configurations?.schema?.tables],
  );

  const activeDirectDatabase = useMemo(() => {
    const directDatabase = workspace?.configurations?.directDatabase;
    const connections = directDatabase?.connections ?? [];
    return (
      connections.find((connection) => connection.id === directDatabase?.activeConnectionId) ??
      connections[0] ??
      null
    );
  }, [workspace?.configurations?.directDatabase]);

  const canImport = useMemo(
    () =>
      Boolean(ingestFile) &&
      Boolean(parsedFile?.headers.length) &&
      Boolean(tableName.trim()) &&
      !ingesting,
    [ingestFile, parsedFile, ingesting, tableName],
  );

  function resetWorkflow() {
    setIngestStep("source");
    setSource(null);
    setIngestFile(null);
    setParsedFile(null);
    setIngestPreview(null);
    setColumnMappings({});
    setColumnStats([]);
    setIssues([]);
    setTableName("");
    setDelimiter(DEFAULT_DELIMITER);
    setEncoding(DEFAULT_ENCODING);
    setHasHeaderRow(true);
    setAppendToExisting(false);
    setIngestError(null);
  }

  function applyParsedFile(parsed: ParsedFile, file: File) {
    if (!parsed.headers.length) {
      setIngestError("We couldn't read that file. Check the format and try again.");
      setParsedFile(null);
      setIngestPreview(null);
      setColumnMappings({});
      setColumnStats([]);
      setIssues([]);
      return false;
    }
    const normalized = ensureUniqueIdentifiers(
      parsed.headers.map((header, index) =>
        normalizeIdentifier(header, `column_${index + 1}`),
      ),
    );
    const mappings = parsed.headers.reduce<Record<string, string>>(
      (acc, header, index) => {
        acc[header] = normalized[index];
        return acc;
      },
      {},
    );
    const stats = computeColumnStats(parsed);
    const detectedIssues = detectIssues(parsed, stats);

    setParsedFile(parsed);
    setIngestPreview({
      headers: parsed.headers,
      rows: parsed.rows.slice(0, 8),
    });
    setColumnMappings(mappings);
    setColumnStats(stats);
    setIssues(detectedIssues);
    if (!tableName.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      setTableName(normalizeIdentifier(baseName, ""));
    }
    return true;
  }

  async function handleSourceSelect(nextSource: IngestSourceKind) {
    setSource(nextSource);
    setIngestError(null);
    setIngestStep("upload");
  }

  async function handleFileSelected(file: File | null) {
    if (!file) {
      setIngestFile(null);
      setParsedFile(null);
      setIngestPreview(null);
      setColumnMappings({});
      setColumnStats([]);
      setIssues([]);
      setTableName("");
      setAppendToExisting(false);
      setIngestError(null);
      setIngestSuccess(null);
      return;
    }
    const inferredSource: IngestSourceKind =
      source ?? (file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx");
    setSource(inferredSource);
    setIngestError(null);
    setIngestSuccess(null);
    setIngestFile(file);

    let nextDelimiter = delimiter;
    if (inferredSource === "csv") {
      nextDelimiter = await sniffCsvDelimiter(file, encoding);
      setDelimiter(nextDelimiter);
    }

    try {
      const parsed = await parseFile(file, {
        source: inferredSource,
        delimiter: nextDelimiter,
        encoding,
        hasHeaderRow,
      });
      if (!applyParsedFile(parsed, file)) {
        setIngestStep("upload");
        return;
      }
      setIngestStep("configure");
    } catch {
      setIngestError("We couldn't read that file. Check the format and try again.");
      setIngestStep("upload");
    }
  }

  function handlePasteFile(event: ClipboardEvent<HTMLDivElement>) {
    const pasted = event.clipboardData?.files?.[0];
    if (pasted) {
      event.preventDefault();
      void handleFileSelected(pasted);
    }
  }

  function handleDropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const dropped = event.dataTransfer?.files?.[0] ?? null;
    if (dropped) {
      void handleFileSelected(dropped);
    }
  }

  function handleMappingChange(header: string, value: string) {
    if (!parsedFile) return;
    setColumnMappings((prev) => {
      const next = { ...prev, [header]: value };
      const normalized = ensureUniqueIdentifiers(
        parsedFile.headers.map((currentHeader, index) =>
          normalizeIdentifier(
            next[currentHeader] ?? currentHeader,
            `column_${index + 1}`,
          ),
        ),
      );
      return parsedFile.headers.reduce<Record<string, string>>(
        (acc, currentHeader, index) => {
          acc[currentHeader] = normalized[index];
          return acc;
        },
        {},
      );
    });
  }

  function handleAppendToExistingChange(value: boolean) {
    setAppendToExisting(value);
    if (value) {
      setTableName(tableOptions[0] ?? "");
    }
  }

  const reparseWithCurrentOptions = useCallback(
    async (overrides: Partial<{ delimiter: string; encoding: string; hasHeaderRow: boolean }> = {}) => {
      if (!ingestFile) return;
      const nextSource: IngestSourceKind =
        source ?? (ingestFile.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx");
      setReparsing(true);
      try {
        const parsed = await parseFile(ingestFile, {
          source: nextSource,
          delimiter: overrides.delimiter ?? delimiter,
          encoding: overrides.encoding ?? encoding,
          hasHeaderRow: overrides.hasHeaderRow ?? hasHeaderRow,
        });
        applyParsedFile(parsed, ingestFile);
      } catch {
        setIngestError("We couldn't read that file. Check the format and try again.");
      } finally {
        setReparsing(false);
      }
    },
    [ingestFile, source, delimiter, encoding, hasHeaderRow, t],
  );

  async function handleDelimiterChange(value: string) {
    setDelimiter(value);
    await reparseWithCurrentOptions({ delimiter: value });
  }

  async function handleEncodingChange(value: string) {
    setEncoding(value);
    await reparseWithCurrentOptions({ encoding: value });
  }

  async function handleHasHeaderRowChange(value: boolean) {
    setHasHeaderRow(value);
    await reparseWithCurrentOptions({ hasHeaderRow: value });
  }

  async function handleReInferTypes() {
    if (!parsedFile) return;
    const stats = computeColumnStats(parsedFile);
    setColumnStats(stats);
    setIssues(detectIssues(parsedFile, stats));
  }

  async function submitDirectDatabase(action: "test" | "save") {
    if (!databaseConnectionString.trim()) {
      setDatabaseError("Enter a Postgres connection string.");
      return;
    }
    const setBusy = action === "test" ? setDatabaseTesting : setDatabaseSaving;
    setBusy(true);
    setDatabaseError(null);
    setDatabaseSuccess(null);
    try {
      if (!workspaceId) throw new Error("Missing workspace id");
      await callWorkspaceAction(subagentId, workspaceId, "connections", {
        method: "POST",
        body: {
          action,
          connection: {
            name: databaseName.trim() || "Postgres database",
            provider: "postgres",
            connectionString: databaseConnectionString.trim(),
            schema: databaseSchemaName.trim() || undefined,
            ssl: databaseSsl,
          },
        },
      });
    } catch (error) {
      if (error instanceof LocalWorkspaceApiError && error.status === 501) {
        setDatabaseError(
          "Direct database connections are not available in local mode.",
        );
      } else {
        setDatabaseError(error instanceof Error ? error.message : "Database connection failed");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleAutoRenameSnakeCase() {
    if (!parsedFile) return;
    const normalized = ensureUniqueIdentifiers(
      parsedFile.headers.map((header, index) =>
        normalizeIdentifier(header, `column_${index + 1}`),
      ),
    );
    const mappings = parsedFile.headers.reduce<Record<string, string>>(
      (acc, header, index) => {
        acc[header] = normalized[index];
        return acc;
      },
      {},
    );
    setColumnMappings(mappings);
  }

  function handleReplaceFile() {
    setIngestFile(null);
    setParsedFile(null);
    setIngestPreview(null);
    setColumnMappings({});
    setColumnStats([]);
    setIssues([]);
    setIngestStep("upload");
  }

  function goToStep(step: IngestStep) {
    setIngestStep(step);
  }

  async function handleImport() {
    if (!ingestFile) {
      setIngestError("Choose a CSV or XLSX file to continue.");
      return;
    }
    if (!tableName.trim()) {
      setIngestError("Enter a table name to continue.");
      return;
    }
    setIngesting(true);
    setIngestError(null);
    setIngestSuccess(null);
    setIngestProgress(0);
    setIngestPhase("uploading");
    setIngestProgressLabel("Uploading file...");
    try {
      if (!workspaceId) throw new Error("Missing workspace id");
      const { uploadKey } = await postWorkspaceUploadUrl(subagentId, workspaceId, ingestFile);

      setIngestProgress(10);
      setIngestPhase("parsing");
      setIngestProgressLabel("Parsing file...");

      let lastSchema: WorkspaceSchema | null = null;
      let lastRowCount = 0;

      for await (const event of streamWorkspaceIngest(subagentId, workspaceId, {
        uploadKey,
        tableName: tableName.trim(),
        columnMappings,
        appendToExisting,
        delimiter,
        encoding,
        hasHeaderRow,
      })) {
        if (event.type === "progress") {
          setIngestProgress(event.percent || 0);
          setIngestPhase(event.phase || "");

          if (event.phase === "parsing") {
            setIngestProgressLabel("Parsing file...");
          } else if (event.phase === "inserting") {
            const current = event.current?.toLocaleString() || "0";
            const total = event.total?.toLocaleString() || "0";
            setIngestProgressLabel(
              "Inserting " + current + " / " + total + " rows...",
            );
          } else if (event.phase === "uploading") {
            setIngestProgressLabel("Saving database...");
          }
        } else if (event.type === "done") {
          lastRowCount = (event.rowCount as number) || 0;
          lastSchema = (event.schema as WorkspaceSchema) || null;
        } else if (event.type === "error") {
          throw new Error((event.message as string) || "Ingestion failed");
        }
      }

      setIngestProgress(100);
      setIngestProgressLabel("Import complete");

      if (lastSchema) {
        setWorkspace((prev) =>
          prev
            ? {
                ...prev,
                configurations: {
                  ...prev.configurations,
                  schema: lastSchema!,
                },
              }
            : prev,
        );
      }

      const normalizedTableName = normalizeIdentifier(tableName.trim(), "");
      setIngestSuccess(
        "Imported " + lastRowCount + " rows into " + normalizedTableName + ".",
      );
      resetWorkflow();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to import data.";
      setIngestError(message);
    } finally {
      setIngesting(false);
      setIngestProgress(null);
      setIngestPhase("");
    }
  }

  return {
    ingestStep,
    goToStep,
    source,
    ingestFile,
    parsedFile,
    ingestPreview,
    columnMappings,
    columnStats,
    issues,
    tableName,
    setTableName,
    delimiter,
    encoding,
    hasHeaderRow,
    appendToExisting,
    reparsing,
    ingestError,
    ingestSuccess,
    ingesting,
    ingestProgress,
    ingestPhase,
    ingestProgressLabel,
    tableOptions,
    canImport,
    activeDirectDatabase,
    databaseName,
    setDatabaseName,
    databaseConnectionString,
    setDatabaseConnectionString,
    databaseSchemaName,
    setDatabaseSchemaName,
    databaseSsl,
    setDatabaseSsl,
    databaseSaving,
    databaseTesting,
    databaseError,
    databaseSuccess,
    handleSourceSelect,
    handleFileSelected,
    handlePasteFile,
    handleDropFile,
    handleMappingChange,
    handleAppendToExistingChange,
    handleDelimiterChange,
    handleEncodingChange,
    handleHasHeaderRowChange,
    handleAutoRenameSnakeCase,
    handleReInferTypes,
    handleTestDirectDatabase: () => submitDirectDatabase("test"),
    handleSaveDirectDatabase: () => submitDirectDatabase("save"),
    handleReplaceFile,
    handleImport,
  };
}

export type UseDataIngestionReturn = ReturnType<typeof useDataIngestion>;
