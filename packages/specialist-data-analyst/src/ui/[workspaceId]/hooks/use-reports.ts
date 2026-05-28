"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { callWorkspaceAction } from "@dude/workspaces";
import type { ChatImageAttachment, ReportItem } from "../types";
import { buildReportSystemPrompt } from "@dude/data-analyst-core/render/catalog";
import { migrateReports } from "@dude/data-analyst-core/render/migration";
import {
  DEFAULT_CHART_COLORS,
  parseReportAnswer,
  inferReportSpan,
  enforceGeoMapIfNeeded,
  buildFallbackRenderSpec,
  buildReportTitle,
  buildReportHistorySnapshot,
} from "../report-utils";


export function useReports({
  workspaceId,
  mounted,
  workspace,
  specialistId,
  runAssistantLoop,
  fileToDataUrl,
}: {
  workspaceId: string | undefined;
  mounted: boolean;
  workspace: import("../types").Workspace | null;
  specialistId: "data-analyst";
  runAssistantLoop: (
    userMessage: string,
    history: JsonValue[],
    userImages?: string[],
  ) => Promise<JsonValue>;
  fileToDataUrl: (file: File) => Promise<string>;
}) {
  const REPORT_SYSTEM_PROMPT = buildReportSystemPrompt();

  // --- State ---
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportPrompt, setReportPrompt] = useState("");
  const [reportAttachments, setReportAttachments] = useState<
    ChatImageAttachment[]
  >([]);
  const [reportQuery, setReportQuery] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [chartColors, setChartColors] = useState<string[]>(
    DEFAULT_CHART_COLORS,
  );
  const [pendingReportPrompt, setPendingReportPrompt] = useState<string | null>(
    null,
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportQuestionContext, setReportQuestionContext] = useState<{
    question: string;
    originalPrompt: string;
    reportId: string | null;
  } | null>(null);
  const [reportRefreshing, setReportRefreshing] = useState(false);

  // --- Refs ---
  const reportsRef = useRef<ReportItem[]>([]);
  const reportsInitializedRef = useRef(false);
  const reportsSaveTimeoutRef = useRef<number | null>(null);
  const settingsInitializedRef = useRef(false);
  const settingsSaveTimeoutRef = useRef<number | null>(null);
  const lastSchemaUpdatedAtRef = useRef<string | null>(null);
  // --- Memos ---
  const canGenerateReport = useMemo(
    () =>
      (Boolean(reportPrompt.trim()) || reportAttachments.length > 0) &&
      !reportSending,
    [reportPrompt, reportAttachments.length, reportSending],
  );

  // --- Effects ---

  useEffect(() => {
    reportsRef.current = reports;
  }, [reports]);

  useEffect(() => {
    const updatedAt = workspace?.configurations?.schema?.updatedAt;
    if (!updatedAt || reportQuestionContext) return;
    if (!lastSchemaUpdatedAtRef.current) {
      lastSchemaUpdatedAtRef.current = updatedAt;
      return;
    }
    if (lastSchemaUpdatedAtRef.current !== updatedAt) {
      lastSchemaUpdatedAtRef.current = updatedAt;
      if (reportsRef.current.length > 0) {
        void refreshReportsForSchema();
      }
    }
  }, [
    workspace?.configurations?.schema?.updatedAt,
    reportQuestionContext,
  ]);

  useEffect(() => {
    if (!mounted || !workspaceId) return;
    if (reportsInitializedRef.current) return;
    reportsInitializedRef.current = true;
    void loadReportsFromDb();
  }, [mounted, workspaceId]);

  useEffect(() => {
    if (!mounted || !workspaceId) return;
    if (!reportsInitializedRef.current) return;
    if (reportsSaveTimeoutRef.current) {
      window.clearTimeout(reportsSaveTimeoutRef.current);
    }
    reportsSaveTimeoutRef.current = window.setTimeout(() => {
      void saveReportsToDb(reports);
    }, 800);
    return () => {
      if (reportsSaveTimeoutRef.current) {
        window.clearTimeout(reportsSaveTimeoutRef.current);
      }
    };
  }, [reports, mounted, workspaceId]);

  useEffect(() => {
    if (!mounted || !workspaceId) return;
    if (settingsInitializedRef.current) return;
    settingsInitializedRef.current = true;
    void loadSettingsFromDb();
  }, [mounted, workspaceId]);

  useEffect(() => {
    if (!mounted || !workspaceId) return;
    if (!settingsInitializedRef.current) return;
    if (settingsSaveTimeoutRef.current) {
      window.clearTimeout(settingsSaveTimeoutRef.current);
    }
    settingsSaveTimeoutRef.current = window.setTimeout(() => {
      void saveSettingsToDb(chartColors);
    }, 800);
    return () => {
      if (settingsSaveTimeoutRef.current) {
        window.clearTimeout(settingsSaveTimeoutRef.current);
      }
    };
  }, [chartColors, mounted, workspaceId]);

  // --- DB persistence ---

  async function loadSettingsFromDb() {
    if (!workspaceId) return;
    try {
      const data = (await callWorkspaceAction(specialistId, workspaceId, "settings", {
        method: "GET",
      })) as { chartColors?: string[] };
      if (Array.isArray(data.chartColors) && data.chartColors.length) {
        setChartColors(
          data.chartColors.filter((color: unknown) => typeof color === "string") as string[],
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save.";
      setReportError(message);
    }
  }

  async function saveSettingsToDb(nextColors: string[]) {
    if (!workspaceId) return;
    try {
      const safeColors = nextColors.filter(
        (color) => typeof color === "string" && color.trim(),
      );
      await callWorkspaceAction(specialistId, workspaceId, "settings", {
        method: "POST",
        body: {
          chartColors: safeColors.length ? safeColors : DEFAULT_CHART_COLORS,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save.";
      setReportError(message);
    }
  }

  async function loadReportsFromDb() {
    if (!workspaceId) return;
    try {
      const data = (await callWorkspaceAction(specialistId, workspaceId, "reports", {
        method: "GET",
      })) as { reports?: ReportItem[] };
      const parsed = Array.isArray(data.reports) ? data.reports : [];
      if (parsed.length) {
        const normalized = parsed.map((report: ReportItem, index: number) => ({
          ...report,
          position:
            typeof report.position === "number" ? report.position : index,
        }));
        normalized.sort((a: ReportItem, b: ReportItem) => {
          const pinnedDelta =
            Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
          if (pinnedDelta !== 0) return pinnedDelta;
          return (a.position ?? 0) - (b.position ?? 0);
        });
        setReports(migrateReports(normalized));
        return;
      }
      if (reportsRef.current.length) {
        await saveReportsToDb(reportsRef.current);
        return;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save.";
      setReportError(message);
    }
  }

  async function saveReportsToDb(nextReports: ReportItem[]) {
    if (!workspaceId) return;
    try {
      await callWorkspaceAction(specialistId, workspaceId, "reports", {
        method: "POST",
        body: {
          reports: nextReports,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save.";
      setReportError(message);
    }
  }

  // --- Image attachments ---

  async function handleAttachReportImages(files: File[]) {
    if (!files.length) return;
    const MAX_ATTACHMENTS = 4;
    const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
    const remainingSlots = Math.max(
      0,
      MAX_ATTACHMENTS - reportAttachments.length,
    );
    if (remainingSlots <= 0) {
      setReportError("You can attach up to 4 images per report prompt.");
      return;
    }
    setReportError(null);
    const acceptedFiles = files.filter((file) => file.type.startsWith("image/"));
    const limitedFiles = acceptedFiles.slice(0, remainingSlots);
    if (!limitedFiles.length) {
      setReportError("Only image files are supported.");
      return;
    }
    const nextAttachments: ChatImageAttachment[] = [];
    for (const file of limitedFiles) {
      if (file.size > MAX_IMAGE_BYTES) {
        setReportError(`Image "${file.name}" exceeds 8MB.`);
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        nextAttachments.push({
          id: crypto.randomUUID(),
          name: file.name,
          mimeType: file.type || "image/*",
          dataUrl,
        });
      } catch {
        setReportError(`Could not read image "${file.name}".`);
      }
    }
    if (nextAttachments.length) {
      setReportAttachments((prev) =>
        [...prev, ...nextAttachments].slice(0, MAX_ATTACHMENTS),
      );
    }
  }

  // --- Report generation & manipulation ---

  async function handleGenerateReport() {
    if (!workspaceId || !canGenerateReport) return;
    setReportSending(true);
    setReportError(null);
    const userPrompt = reportPrompt.trim();
    const reportImages = reportAttachments.map(
      (attachment) => attachment.dataUrl,
    );
    const fallbackTitle = "Generated report";
    const questionContext = reportQuestionContext;
    let keepQuestion = false;
    setReportPrompt("");
    setReportAttachments([]);
    setPendingReportPrompt(userPrompt);
    try {
      let targetReportId = selectedReportId;
      const targetReport = targetReportId
        ? reports.find((report) => report.id === targetReportId) ?? null
        : null;
      let history = buildReportHistorySnapshot(REPORT_SYSTEM_PROMPT, targetReport);
      if (questionContext) {
        history = [
          ...buildReportHistorySnapshot(REPORT_SYSTEM_PROMPT, targetReport),
          { role: "user", message: questionContext.originalPrompt },
          { role: "assistant", message: questionContext.question },
        ];
        targetReportId = questionContext.reportId;
      }
      const data = await runAssistantLoop(userPrompt, history, reportImages);
      if (data?.type === "question" && data.question) {
        setReportQuestionContext({
          question: data.question,
          originalPrompt: questionContext?.originalPrompt ?? userPrompt,
          reportId: targetReportId ?? null,
        });
        keepQuestion = true;
        return;
      }
      const parsed =
        typeof data.answer === "string" ? parseReportAnswer(data.answer) : null;
      const rawRenderSpec =
        parsed?.renderSpec ?? buildFallbackRenderSpec(data.toolResults);
      const renderSpec = enforceGeoMapIfNeeded(userPrompt, rawRenderSpec);
      const summary =
        parsed?.summary ??
        (parsed
          ? undefined
          : typeof data.answer === "string"
          ? data.answer
          : undefined);
      if (targetReportId) {
        setReports((prev) =>
          prev.map((report) =>
            report.id === targetReportId
              ? {
                  ...report,
                  pinned: report.pinned,
                  prompt: userPrompt,
                  title:
                    parsed?.title ||
                    report.title ||
                    buildReportTitle(userPrompt, fallbackTitle),
                  summary,
                  renderSpec,
                  chart: parsed?.chart ?? null,
                  artifact: parsed?.artifact ?? null,
                  rawAnswer:
                    typeof data.answer === "string" ? data.answer : undefined,
                  toolResults: Array.isArray(data.toolResults)
                    ? data.toolResults
                    : [],
                }
              : report,
          ),
        );
        if (!questionContext) {
          setSelectedReportId(null);
        }
      } else {
        // Pick sizing based on the visualization type in the spec
        const specSpan = inferReportSpan(renderSpec);
        const newReport: ReportItem = {
          id: crypto.randomUUID(),
          prompt: userPrompt,
          title: parsed?.title || buildReportTitle(userPrompt, fallbackTitle),
          summary,
          createdAt: new Date().toISOString(),
          renderSpec,
          chart: parsed?.chart ?? null,
          artifact: parsed?.artifact ?? null,
          colSpan: specSpan.colSpan,
          rowSpan: specSpan.rowSpan,
          rawAnswer: typeof data.answer === "string" ? data.answer : undefined,
          toolResults: Array.isArray(data.toolResults) ? data.toolResults : [],
        };
        setReports((prev) => [newReport, ...prev]);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to generate report.";
      setReportError(message);
    } finally {
      setReportSending(false);
      setPendingReportPrompt(null);
      if (!keepQuestion) {
        setReportQuestionContext(null);
      }
    }
  }

  function handleDeleteReport(reportId: string) {
    setReports((prev) => prev.filter((report) => report.id !== reportId));
  }

  function handleUpdateReportSize(
    reportId: string,
    colSpan: number,
    rowSpan: number,
  ) {
    setReports((prev) =>
      prev.map((report) =>
        report.id === reportId ? { ...report, colSpan, rowSpan } : report,
      ),
    );
  }

  function handlePinReport(reportId: string, pinned: boolean) {
    setReports((prev) =>
      prev.map((report) =>
        report.id === reportId ? { ...report, pinned } : report,
      ),
    );
  }

  function handleSelectReport(reportId: string | null) {
    setSelectedReportId(reportId);
  }

  async function regenerateReport(
    report: ReportItem,
    baseReports: ReportItem[],
  ) {
    const fallbackTitle = "Generated report";
    const history = buildReportHistorySnapshot(REPORT_SYSTEM_PROMPT, report);
    const data = await runAssistantLoop(report.prompt, history);
    if (data?.type === "question" && data.question) {
      return;
    }
    const parsed =
      typeof data.answer === "string" ? parseReportAnswer(data.answer) : null;
    const rawRenderSpec =
      parsed?.renderSpec ?? buildFallbackRenderSpec(data.toolResults);
    const renderSpec = enforceGeoMapIfNeeded(report.prompt, rawRenderSpec);
    const summary =
      parsed?.summary ??
      (parsed
        ? undefined
        : typeof data.answer === "string"
        ? data.answer
        : undefined);

    setReports((prev) =>
      prev.map((item) =>
        item.id === report.id
          ? {
              ...item,
              title:
                parsed?.title || item.title || buildReportTitle(report.prompt, fallbackTitle),
              summary,
              renderSpec,
              chart: parsed?.chart ?? null,
              artifact: parsed?.artifact ?? null,
              rawAnswer:
                typeof data.answer === "string" ? data.answer : undefined,
              toolResults: Array.isArray(data.toolResults)
                ? data.toolResults
                : [],
            }
          : item,
      ),
    );
  }

  async function generateSingleReport(
    prompt: string,
  ): Promise<ReportItem | null> {
    const fallbackTitle = "Generated report";
    const history = buildReportHistorySnapshot(REPORT_SYSTEM_PROMPT, null);
    const data = await runAssistantLoop(prompt, history);
    if (data?.type === "question") return null;

    const parsed =
      typeof data.answer === "string" ? parseReportAnswer(data.answer) : null;
    const rawRenderSpec =
      parsed?.renderSpec ?? buildFallbackRenderSpec(data.toolResults);
    const renderSpec = enforceGeoMapIfNeeded(prompt, rawRenderSpec);
    const summary =
      parsed?.summary ??
      (parsed
        ? undefined
        : typeof data.answer === "string"
          ? data.answer
          : undefined);
    const specSpan = inferReportSpan(renderSpec);

    return {
      id: crypto.randomUUID(),
      prompt,
      title: parsed?.title || buildReportTitle(prompt, fallbackTitle),
      summary,
      createdAt: new Date().toISOString(),
      renderSpec,
      chart: parsed?.chart ?? null,
      artifact: parsed?.artifact ?? null,
      colSpan: specSpan.colSpan,
      rowSpan: specSpan.rowSpan,
      rawAnswer: typeof data.answer === "string" ? data.answer : undefined,
      toolResults: Array.isArray(data.toolResults) ? data.toolResults : [],
    };
  }

  async function refreshReportsForSchema() {
    if (
      reportRefreshing ||
      reportSending ||
      pendingReportPrompt ||
      reportQuestionContext
    )
      return;
    if (!reports.length) return;
    setReportRefreshing(true);
    try {
      const snapshot = [...reports];
      for (const report of snapshot) {
        await regenerateReport(report, snapshot);
      }
    } catch {
      // Ignore refresh errors to avoid blocking the UI.
    } finally {
      setReportRefreshing(false);
    }
  }

  return {
    reports,
    reportPrompt,
    setReportPrompt,
    reportAttachments,
    setReportAttachments,
    reportQuery,
    setReportQuery,
    reportSending,
    reportError,
    chartColors,
    setChartColors,
    selectedReportId,
    reportQuestionContext,
    reportRefreshing,
    pendingReportPrompt,
    canGenerateReport,
    handleAttachReportImages,
    handleGenerateReport,
    handleDeleteReport,
    handleUpdateReportSize,
    handlePinReport,
    handleSelectReport,
    addReports: (newReports: ReportItem[]) => {
      setReports((prev) => [...newReports, ...prev]);
    },
  };
}
