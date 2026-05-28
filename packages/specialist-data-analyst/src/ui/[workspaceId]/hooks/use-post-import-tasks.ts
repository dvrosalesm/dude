"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ColumnStats,
  DataOverview,
  DetectedRelationship,
  QualityScanResult,
  Workspace,
  WorkspaceMessage,
  WorkspaceSchema,
} from "../types";
import { runQualityScan } from "../lib/quality-scan-queries";
import { detectRelationships } from "../lib/relationship-detector";
import { runColumnStats } from "../lib/column-stats-queries";

export function usePostImportTasks({
  workspace,
  runSql,
  runAssistantLoop,
  messages,
  setMessages,
  dataReadyLabel,
}: {
  workspace: Workspace | null;
  runSql: (
    query: string,
  ) => Promise<{ columns: string[]; rows: Array<Record<string, unknown>> }>;
  runAssistantLoop: (
    userMessage: string,
    history: JsonValue[],
    userImages?: string[],
  ) => Promise<JsonValue>;
  messages: WorkspaceMessage[];
  setMessages: React.Dispatch<React.SetStateAction<WorkspaceMessage[]>>;
  /** Translated placeholder messages. */
  preparingLabel?: string;
  dataReadyLabel?: string;
}) {
  // --- State ---
  const [qualityScan, setQualityScan] = useState<QualityScanResult | null>(null);
  const [qualityScanLoading, setQualityScanLoading] = useState(false);
  const [preloadedOverview, setPreloadedOverview] = useState<DataOverview | null>(null);
  const [previewsLoading, setPreviewsLoading] = useState(false);
  const [detectedRelationships, setDetectedRelationships] = useState<DetectedRelationship[]>([]);
  const [columnStats, setColumnStats] = useState<Record<string, ColumnStats[]> | null>(null);
  const [columnStatsLoading, setColumnStatsLoading] = useState(false);
  const [postImportRunning, setPostImportRunning] = useState(false);
  const [postImportProgress, setPostImportProgress] = useState(0);
  const [postImportTotal] = useState(5); // 5 tasks total

  // --- Refs ---
  const hasRunRef = useRef(false);
  const lastSchemaRef = useRef<string | null>(null);
  const messagesRef = useRef<WorkspaceMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // --- Trigger ---
  useEffect(() => {
    const schema = workspace?.configurations?.schema;
    const updatedAt = schema?.updatedAt;
    if (!updatedAt || !schema) return;

    if (!lastSchemaRef.current) {
      lastSchemaRef.current = updatedAt;
      // First load — run if schema has data
      if (Object.keys(schema.tables).length > 0 && !hasRunRef.current) {
        hasRunRef.current = true;
        void runAllTasks(schema);
      }
      return;
    }

    if (lastSchemaRef.current !== updatedAt) {
      lastSchemaRef.current = updatedAt;
      if (Object.keys(schema.tables).length > 0) {
        hasRunRef.current = true;
        void runAllTasks(schema);
      }
    }
  }, [workspace?.configurations?.schema?.updatedAt]);

  async function runAllTasks(schema: WorkspaceSchema) {
    setPostImportRunning(true);
    setPostImportProgress(0);

    try {
      // Feature 4: Relationship detection (instant, pure function)
      const relationships = detectRelationships(schema);
      setDetectedRelationships(relationships);
      setPostImportProgress(1);

      // Phase 1: Run SQL tasks in parallel
      const [qualityResult, previewResult, statsResult] = await Promise.all([
        // Feature 1: Quality scan
        (async () => {
          setQualityScanLoading(true);
          try {
            const result = await runQualityScan(schema, runSql);
            setQualityScan(result);
            return result;
          } finally {
            setQualityScanLoading(false);
            setPostImportProgress((p) => p + 1);
          }
        })(),

        // Feature 3: Auto-load previews
        (async () => {
          setPreviewsLoading(true);
          try {
            const overview = await loadAllPreviews(schema);
            setPreloadedOverview(overview);
            return overview;
          } finally {
            setPreviewsLoading(false);
            setPostImportProgress((p) => p + 1);
          }
        })(),

        // Feature 5: Column statistics
        (async () => {
          setColumnStatsLoading(true);
          try {
            const stats = await runColumnStats(schema, runSql);
            setColumnStats(stats);
            return stats;
          } finally {
            setColumnStatsLoading(false);
            setPostImportProgress((p) => p + 1);
          }
        })(),
      ]);

      // Phase 2: AI-powered dataset summary (only if chat is empty)
      if (messagesRef.current.length === 0) {
        const fallbackMsg = dataReadyLabel || "Your data is ready! Ask me anything about it.";

        try {
          await generateDatasetSummary(schema, qualityResult, statsResult);
        } catch (summaryError) {
          console.error("[PostImport] Dataset summary failed:", summaryError);
          // On failure, show a fallback message
          setMessages((prev) => [
            ...prev,
            { role: "assistant", message: fallbackMsg },
          ]);
        }
      } else {
        // Skipping summary — messages already exist
      }
      setPostImportProgress(5);
    } catch (topError) {
      console.error("[PostImport] Top-level error in runAllTasks:", topError);
    } finally {
      setPostImportRunning(false);
    }
  }

  async function loadAllPreviews(schema: WorkspaceSchema): Promise<DataOverview> {
    const tableNames = Object.keys(schema.tables);
    const tables = await Promise.all(
      tableNames.map(async (tableName) => {
        const table = schema.tables[tableName];
        try {
          const result = await runSql(
            `SELECT * FROM "${tableName}" LIMIT 25`,
          );
          return {
            name: tableName,
            columns: table.columns,
            rowCount: table.rowCount,
            preview: result,
          };
        } catch {
          return {
            name: tableName,
            columns: table.columns,
            rowCount: table.rowCount,
          };
        }
      }),
    );
    return { tables };
  }

  async function generateDatasetSummary(
    schema: WorkspaceSchema,
    qualityResult: QualityScanResult | null,
    statsResult: Record<string, ColumnStats[]> | null,
  ) {
    const tableNames = Object.keys(schema.tables);
    const schemaDesc = tableNames
      .map((name) => {
        const t = schema.tables[name];
        const cols = t.columns.map((c) => `${c.name} (${c.type})`).join(", ");
        return `- ${name}: ${t.rowCount} rows, columns: ${cols}`;
      })
      .join("\n");

    let qualityNote = "";
    if (qualityResult) {
      qualityNote = `\nData quality score: ${qualityResult.overallScore}/100.`;
      const issues: string[] = [];
      for (const table of qualityResult.tables) {
        for (const col of table.columns) {
          if (col.nullCount > 0)
            issues.push(
              `${col.column} in ${table.table}: ${col.nullCount} nulls`,
            );
          if (col.emptyCount > 0)
            issues.push(
              `${col.column} in ${table.table}: ${col.emptyCount} empty values`,
            );
        }
      }
      if (issues.length > 0) {
        qualityNote += ` Notable issues: ${issues.slice(0, 5).join("; ")}.`;
      }
    }

    let statsNote = "";
    if (statsResult) {
      const highlights: string[] = [];
      for (const [tableName, cols] of Object.entries(statsResult)) {
        for (const col of cols) {
          if (col.type === "numeric" && col.min != null && col.max != null) {
            highlights.push(
              `${col.column} in ${tableName}: min=${col.min}, max=${col.max}, avg=${col.avg}`,
            );
          } else if (col.type === "text" && col.cardinality != null) {
            highlights.push(
              `${col.column} in ${tableName}: ${col.cardinality} unique values`,
            );
          }
        }
      }
      if (highlights.length > 0) {
        statsNote = `\nKey statistics: ${highlights.slice(0, 8).join("; ")}.`;
      }
    }

    const prompt = [
      "The user just opened a new session with their data. Greet them and provide a concise summary.",
      "Describe what the data appears to be about, its structure, and any key insights you spot.",
      "End with 3-5 specific suggestions of things they can ask you to do — phrased as actionable questions they can copy-paste.",
      "For example: 'What was our revenue trend over the last 6 months?' or 'Which product category has the highest margin?'",
      "Tailor the suggestions to the actual data — use real column and table names.",
      `\nSchema:\n${schemaDesc}`,
      qualityNote,
      statsNote,
      "\nKeep the summary under 200 words. Be warm, specific, and actionable.",
    ].join("\n");

    const data = await runAssistantLoop(prompt, []);
    if (data?.type === "question") return;

    const answer = data?.answer || "";
    if (answer) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          message: answer,
          steps: Array.isArray(data.steps) ? data.steps : [],
          answer,
          toolResults: Array.isArray(data.toolResults) ? data.toolResults : [],
          executionTrace: data.executionTrace,
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : undefined,
        },
      ]);
    }
  }

  return {
    qualityScan,
    qualityScanLoading,
    preloadedOverview,
    previewsLoading,
    detectedRelationships,
    columnStats,
    columnStatsLoading,
    postImportRunning,
    postImportProgress,
    postImportTotal,
  };
}
