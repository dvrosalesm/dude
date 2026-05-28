"use client";

import { useEffect, useState } from "react";
import { getWorkspaceById } from "@dude/workspaces";
import type { Workspace, WorkspaceMessage } from "../types";

const SPECIALIST_ID = "data-analyst" as const;

export function useWorkspaceLoader(workspaceId: string | undefined) {
  const [mounted, setMounted] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messagesLoaded, setMessagesLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      if (!workspaceId) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await getWorkspaceById(workspaceId);
        if (!cancelled) {
          setWorkspace(data.workspace || null);
          const msgs = Array.isArray(data.messages) ? data.messages : [];
          setMessages(
            msgs
              .filter((m: JsonValue) => m.role && m.message)
              .map((m: JsonValue) => ({
                message: m.message,
                role: m.role,
                date: m.date || m.created_at,
                steps: m.steps,
                answer: m.answer,
                executionTrace: m.executionTrace,
                suggestions: m.suggestions,
              })),
          );
          if (!messagesLoaded) {
            if (msgs.length === 0 && workspaceId) {
              localStorage.removeItem(`data-analyst-gateway-session:${workspaceId}`);
            }
            setMessagesLoaded(true);
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : "Failed to load workspace.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return {
    mounted,
    workspace,
    setWorkspace,
    messages,
    setMessages,
    messagesLoaded,
    isLoading,
    error,
    subagentId: SPECIALIST_ID,
    workspaceId,
  };
}
