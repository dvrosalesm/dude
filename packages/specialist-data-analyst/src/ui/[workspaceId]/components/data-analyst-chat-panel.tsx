"use client";

import { useCallback, useEffect } from "react";
import { SpecialistChat } from "@dude/chat/specialists/specialist-chat";
import { useSpecialistChat } from "@dude/chat/specialists/hooks/use-specialist-chat";
import type { SpecialistMessage } from "@dude/chat/specialists/types";
import { Code, Database, Save, Search, Globe } from "lucide-react";
import { QueryProvider } from "@dude/data-analyst-core/render/query-context";
import { createWorkspaceSqlQuery } from "../workspace-sql-query";
import type { Workspace } from "../types";

interface DataAnalystChatPanelProps {
  messages: SpecialistMessage[];
  setMessages: React.Dispatch<React.SetStateAction<SpecialistMessage[]>>;
  messagesLoaded: boolean;
  onWorkspaceChanged: () => Promise<void>;
  onSendingChange?: (sending: boolean) => void;
  workspace: Workspace | null;
  workspaceId?: string;
  onSaveReport?: (spec: Record<string, unknown>) => void;
}

const TOOL_ICONS: Record<string, typeof Code> = {
  sql: Database,
  python: Code,
  save_database: Save,
  workspace_read: Search,
  web_search: Globe,
};

function toolArgPreview(
  tool: string,
  args: Record<string, unknown>,
): string {
  if (tool === "sql") return String(args.query || "").slice(0, 120);
  if (tool === "python") return String(args.code || "").slice(0, 120);
  if (tool === "save_database") return "Saving database...";
  return JSON.stringify(args).slice(0, 120);
}

export function DataAnalystChatPanel({
  messages,
  setMessages,
  messagesLoaded,
  onWorkspaceChanged,
  onSendingChange,
  workspace,
  workspaceId,
  onSaveReport,
}: DataAnalystChatPanelProps) {
  const hasSchema = Boolean(workspace?.configurations?.schema);

  const chat = useSpecialistChat({
    specialistId: "data-analyst",
    workspaceId,
    messages,
    setMessages,
    messagesLoaded,
    bootMessage: () =>
      hasSchema
        ? `Greet the user and ask what they'd like to analyze or explore in their data. They already have data loaded. Keep it brief and friendly.`
        : `The user just opened a new data analyst workspace. Introduce yourself as the Data Analyst, explain what you can do (analyze data, run queries, create reports, clean data, forecast trends), and let them know they can upload data using the ingestion tab on the right. Keep it brief and friendly.`,
    wakingUpLabel: "Waking up your data analyst...",
    placeholder: "Type a message to start...",
    extraPayload: () => ({
      schema: workspace?.configurations?.schema || null,
    }),
    onAssistantResponse: onWorkspaceChanged,
  });

  useEffect(() => {
    onSendingChange?.(chat.sending);
  }, [chat.sending, onSendingChange]);

  const runQuery = useCallback(
    createWorkspaceSqlQuery("data-analyst", workspaceId ?? ""),
    [workspaceId],
  );

  return (
    <QueryProvider runQuery={runQuery}>
      <SpecialistChat
        {...chat.chatProps}
        toolIcons={TOOL_ICONS}
        argPreview={toolArgPreview}
        inputLayout="floating"
        onSaveReport={onSaveReport}
      />
    </QueryProvider>
  );
}
