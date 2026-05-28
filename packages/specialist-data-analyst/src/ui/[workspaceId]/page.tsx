"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import { useWorkspaceId } from "@dude/specialist-params";
import { WorkspaceHeaderBar } from "@dude/chat/specialists/workspace-header-bar";
import {
  SpecialistWorkspaceFrame,
  SpecialistWorkspaceScroll,
} from "@dude/chat/specialists/specialist-workspace-layout";
import { WorkspaceTabs } from "./components/workspace-tabs";
import { DataIngestionSection } from "./components/data-ingestion-section";
import { DataAnalystChatPanel } from "./components/data-analyst-chat-panel";
import { ReportsSection } from "./components/reports-section";
import { DataOverviewSection } from "./components/data-overview-section";
import { PostImportScreen } from "./components/post-import-screen";
import { useWorkspaceLoader } from "./hooks/use-workspace-loader";
import { useTabRouting } from "./hooks/use-tab-routing";
import { useSqlExecutor } from "./hooks/use-sql-executor";
import { useReports } from "./hooks/use-reports";
import { useDataOverview } from "./hooks/use-data-overview";
import { useDataIngestion } from "./hooks/use-data-ingestion";
import { usePostImportTasks } from "./hooks/use-post-import-tasks";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import { AIGenerationOverlay } from "@dude/ui/components/ai-generation-overlay";
import { updateWorkspaceById } from "@dude/workspaces";
import { specialistListPath } from "@dude/workspaces/routes";
import { inferReportSpan } from "./report-utils";

export default function DataAnalystWorkspacePage() {
  const workspaceId = useWorkspaceId() || undefined;

  const loader = useWorkspaceLoader(workspaceId);
  const tabs = useTabRouting(loader.mounted, loader.workspace);
  const executor = useSqlExecutor(workspaceId, loader.workspace);

  const reports = useReports({
    workspaceId,
    mounted: loader.mounted,
    workspace: loader.workspace,
    specialistId: loader.specialistId,
    runAssistantLoop: executor.runAssistantLoop,
    fileToDataUrl: executor.fileToDataUrl,
  });

  const dataOverview = useDataOverview({
    workspace: loader.workspace,
    setWorkspace: loader.setWorkspace,
    activeTab: tabs.activeTab,
    isLoading: loader.isLoading,
    runSql: executor.runSql,
  });

  const ingestion = useDataIngestion({
    workspace: loader.workspace,
    setWorkspace: loader.setWorkspace,
    specialistId: loader.specialistId,
    workspaceId,
  });

  const postImport = usePostImportTasks({
    workspace: loader.workspace,
    runSql: executor.runSql,
    runAssistantLoop: executor.runAssistantLoop,
    messages: loader.messages,
    setMessages: loader.setMessages,
    preparingLabel: "Hello! Just a second, I'm preparing the dataset and getting everything ready for you...",
    dataReadyLabel: "Your data is ready! Ask me anything about it.",
  });

  // --- Save render spec from chat to reports ---
  const handleSaveReportFromChat = useCallback(
    (spec: Record<string, unknown>) => {
      const elements = spec.elements as StringKeyRecord | undefined;
      const rootEl = elements?.[spec.root as string];
      const title = rootEl?.props?.title || "Chat Report";
      const summary = rootEl?.props?.summary || undefined;
      const span = inferReportSpan(spec);
      reports.addReports([
        {
          id: crypto.randomUUID(),
          prompt: "",
          title,
          summary,
          createdAt: new Date().toISOString(),
          chart: null,
          renderSpec: spec,
          colSpan: span.colSpan,
          rowSpan: span.rowSpan,
        },
      ]);
      tabs.setActiveTab("reports");
    },
    [reports, tabs],
  );

  // --- Post-import full-screen flow ---
  const [postImportActive, setPostImportActive] = useState(false);
  const [chatSending, setChatSending] = useState(false);

  useEffect(() => {
    if (ingestion.ingesting) {
      setPostImportActive(true);
    }
  }, [ingestion.ingesting]);

  useEffect(() => {
    if (ingestion.ingestError) {
      setPostImportActive(false);
    }
  }, [ingestion.ingestError]);

  const postImportPhase = useMemo(() => {
    if (!postImportActive) return null;
    const hasResults =
      postImport.qualityScan !== null || postImport.columnStats !== null;
    const allDone =
      !ingestion.ingesting && !postImport.postImportRunning && hasResults;
    return allDone ? ("complete" as const) : ("processing" as const);
  }, [
    postImportActive,
    ingestion.ingesting,
    postImport.postImportRunning,
    postImport.qualityScan,
    postImport.columnStats,
  ]);

  const handleRename = useCallback(async (name: string) => {
    if (!workspaceId) return;
    try {
      await updateWorkspaceById(workspaceId, { name });
      loader.setWorkspace((prev: Record<string, unknown> | null) => prev ? { ...prev, name } : prev);
    } catch {
      // Silent fail
    }
  }, [workspaceId, loader]);

  if (!loader.mounted) {
    return null;
  }

  return (
    <SpecialistWorkspaceFrame>
      <WorkspaceHeaderBar
        title={loader.workspace?.name || "Workspaces"}
        backHref={specialistListPath("data-analyst")}
        backLabel={"Back to workspaces"}
        onRename={handleRename}
      />

      {loader.isLoading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <BrailleSpinner className="text-2xl text-muted-foreground/60" />
        </div>
      ) : postImportPhase ? (
        <SpecialistWorkspaceScroll className="px-3 py-4 sm:px-6 sm:py-8">
          <PostImportScreen
            phase={postImportPhase}
            ingestProgress={ingestion.ingestProgress}
            ingestProgressLabel={ingestion.ingestProgressLabel}
            postImportProgress={postImport.postImportProgress}
            postImportTotal={postImport.postImportTotal}
            qualityScan={postImport.qualityScan}
            qualityScanLoading={postImport.qualityScanLoading}
            columnStats={postImport.columnStats}
            columnStatsLoading={postImport.columnStatsLoading}
            schema={loader.workspace?.configurations?.schema ?? null}
            detectedRelationships={postImport.detectedRelationships}
            reportsCount={reports.reports.length}
            onChatWithData={() => {
              setPostImportActive(false);
              tabs.setActiveTab("chat");
            }}
          />
        </SpecialistWorkspaceScroll>
      ) : (
        <>
          <WorkspaceTabs
            activeTab={tabs.activeTab}
            onChange={tabs.setActiveTab}
          />
          <SpecialistWorkspaceScroll className="px-3 py-4 sm:px-6 sm:py-8">
            <div className="w-full space-y-6">
              {loader.error && (
                <p className="text-sm text-destructive">{loader.error}</p>
              )}

              <div className="space-y-6">
                {tabs.activeTab === "ingestion" && (
                  <DataIngestionSection ingestion={ingestion} />
                )}

                {tabs.activeTab === "data" && (
                  <DataOverviewSection
                    title={"Data"}
                    description={"Browse the tables and preview rows from the current workspace database."}
                    loading={dataOverview.dataLoading}
                    error={dataOverview.dataError}
                    overview={dataOverview.dataOverview}
                    selectedTable={dataOverview.selectedTableName}
                    onSelectTable={dataOverview.setSelectedTableName}
                    filterText={dataOverview.dataFilterTextInput}
                    appliedFilterText={dataOverview.dataFilterText}
                    filterColumn={dataOverview.dataFilterColumn}
                    onFilterTextChange={dataOverview.setDataFilterTextInput}
                    onFilterColumnChange={dataOverview.setDataFilterColumn}
                    onSearch={dataOverview.handleSearchData}
                    onDeleteTable={dataOverview.handleDeleteTable}
                    deletingTable={dataOverview.deletingTable}
                    onLoadMoreRecords={dataOverview.handleLoadMoreRecords}
                    loadingMoreTable={dataOverview.loadingMoreTable}
                    detectedRelationships={postImport.detectedRelationships}
                    columnStats={postImport.columnStats}
                    columnStatsLoading={postImport.columnStatsLoading}
                    qualityScan={postImport.qualityScan}
                    onChatWithData={() => tabs.setActiveTab("chat")}
                  />
                )}

                {tabs.activeTab === "chat" && (
                  <DataAnalystChatPanel
                    messages={loader.messages}
                    setMessages={loader.setMessages}
                    messagesLoaded={loader.messagesLoaded}
                    onWorkspaceChanged={async () => {
                      // Reload workspace to pick up schema changes from the agent
                    }}
                    onSendingChange={setChatSending}
                    workspace={loader.workspace}
                    workspaceId={workspaceId}
                    onSaveReport={handleSaveReportFromChat}
                  />
                )}

                {tabs.activeTab === "reports" && (
                  <div className="relative">
                    <ReportsSection
                      title={"Reports"}
                      description={"Summaries, charts, and exports will appear here."}
                      emptyLabel={"No reports yet."}
                      reports={reports.reports}
                      chartColors={reports.chartColors}
                      onChartColorsChange={reports.setChartColors}
                      query={reports.reportQuery}
                      onQueryChange={reports.setReportQuery}
                      onDeleteReport={reports.handleDeleteReport}
                      onResizeReport={reports.handleUpdateReportSize}
                      onPinReport={reports.handlePinReport}
                      specialistId={loader.specialistId}
                      workspaceId={workspaceId ?? ""}
                    />
                    <AIGenerationOverlay active={chatSending} borderRadius={16} />
                  </div>
                )}
              </div>
            </div>
          </SpecialistWorkspaceScroll>
        </>
      )}
    </SpecialistWorkspaceFrame>
  );
}
