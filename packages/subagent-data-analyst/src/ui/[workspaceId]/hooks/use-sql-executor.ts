"use client";

import { useGatewaySession } from "@dude/chat/subagents/hooks/use-gateway-session";
import { useAssistantLoop } from "@dude/chat/subagents/hooks/use-assistant-loop";
import { callWorkspaceAction } from "@dude/workspaces";
import type { DebugEntry, WorkspaceMessage, Workspace } from "../types";

export function useSqlExecutor(
  workspaceId: string | undefined,
  workspace: Workspace | null,
) {
  const session = useGatewaySession("data-analyst", workspaceId);

  const { runAssistantLoop: rawLoop, executionTraces } = useAssistantLoop({
    subagentId: "data-analyst",
    workspaceId,
    getSessionId: session.getSessionId,
    saveSessionId: session.saveSessionId,
    extraPayload: () => ({
      schema: workspace?.configurations?.schema || null,
    }),
  });

  async function runSql(query: string) {
    if (!workspaceId) {
      throw new Error("Missing workspace id");
    }
    const data = (await callWorkspaceAction("data-analyst", workspaceId, "query", {
      method: "POST",
      body: { query },
    })) as { columns: string[]; rows: Array<Record<string, unknown>> };
    return data;
  }

  async function runAssistantLoop(
    userMessage: string,
    history: JsonValue[],
    userImages: string[] = [],
  ) {
    const entries = (history as WorkspaceMessage[]).map((m) => ({
      role: m.role,
      content: m.message,
      images: Array.isArray(m.images) && m.role === "user" ? m.images : [],
    }));
    return rawLoop(userMessage, entries, userImages);
  }

  function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error("Failed to read image"));
      };
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });
  }

  return {
    debugLog: [] as DebugEntry[],
    executionTraces,
    runSql,
    runAssistantLoop,
    fileToDataUrl,
  };
}
