"use client";

/**
 * Shared workspace-page loader hook.
 *
 * Owns the boilerplate that every subagent workspace page repeats: load
 * the workspace via `@dude/workspaces`, restore chat messages once,
 * expose loading/error state, and provide `refreshWorkspace` + `handleRename`.
 *
 * The per-subagent work — taking the server `configurations` blob and
 * pushing it into a Zustand store or component state — is delegated to the
 * caller via `applyConfig`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getWorkspaceById,
  updateWorkspaceById,
} from "@dude/workspaces";
import { useWorkspaceId } from "@dude/subagent-params";
import type { SubagentMessage } from "../types";

type WorkspaceConfig = Record<string, unknown>;

export interface ApplyConfigMeta {
  workspaceId: string;
  workspace: Record<string, unknown>;
}

export interface UseSubagentWorkspaceLoaderOptions {
  /** Workspace name shown until the server responds. */
  defaultName: string;
  /** Push the server `configurations` blob into the per-subagent store / state. */
  applyConfig: (config: WorkspaceConfig, meta: ApplyConfigMeta) => void;
  /** Reset store/state when the workspaceId changes. Called before the initial fetch. */
  resetState?: () => void;
  /** Custom message normalizer. Defaults to `{message, role, date}` mapping. */
  normalizeMessages?: (raw: unknown[]) => SubagentMessage[];
}

function defaultNormalizeMessages(raw: unknown[]): SubagentMessage[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((m): m is { role: string; message: string; date?: string } => {
      const x = m as { role?: unknown; message?: unknown };
      return typeof x?.role === "string" && typeof x?.message === "string";
    })
    .map((m) => ({
      role: m.role as SubagentMessage["role"],
      message: m.message,
      date: m.date,
    }));
}

export function useSubagentWorkspaceLoader(
  options: UseSubagentWorkspaceLoaderOptions,
) {
  const {
    defaultName,
    applyConfig,
    resetState,
    normalizeMessages = defaultNormalizeMessages,
  } = options;

  const workspaceId = useWorkspaceId();

  const [workspaceName, setWorkspaceName] = useState(defaultName);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<SubagentMessage[]>([]);
  const [chatMessagesLoaded, setChatMessagesLoaded] = useState(false);
  const messagesLoadedRef = useRef(false);

  const applyConfigRef = useRef(applyConfig);
  applyConfigRef.current = applyConfig;
  const normalizeMessagesRef = useRef(normalizeMessages);
  normalizeMessagesRef.current = normalizeMessages;

  const fetchWorkspace = useCallback(async () => {
    if (!workspaceId) {
      throw new Error("Missing workspace id");
    }
    return getWorkspaceById(workspaceId);
  }, [workspaceId]);

  const loadWorkspace = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkspace();
      const workspace = data.workspace || {};
      const config = workspace.configurations || {};

      setWorkspaceName(workspace.name || defaultName);
      applyConfigRef.current(config, {
        workspaceId,
        workspace: workspace as Record<string, unknown>,
      });

      if (!messagesLoadedRef.current) {
        setChatMessages(normalizeMessagesRef.current(data.messages || []));
        setChatMessagesLoaded(true);
        messagesLoadedRef.current = true;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, [defaultName, fetchWorkspace, workspaceId]);

  /** Re-fetch the workspace and re-apply config. Also refreshes chat when messages are included. */
  const refreshWorkspace = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await fetchWorkspace();
      const workspace = data.workspace || {};
      const config = workspace.configurations || {};
      applyConfigRef.current(config, {
        workspaceId,
        workspace: workspace as Record<string, unknown>,
      });
      if (Array.isArray(data.messages)) {
        setChatMessages(normalizeMessagesRef.current(data.messages));
      }
    } catch {
      // Silent — the user is already on the page; failing a refresh is non-fatal
    }
  }, [fetchWorkspace, workspaceId]);

  const handleRename = useCallback(
    async (name: string) => {
      if (!workspaceId) return;
      try {
        await updateWorkspaceById(workspaceId, { name });
        setWorkspaceName(name);
      } catch {
        // Silent fail
      }
    },
    [workspaceId],
  );

  const resetStateRef = useRef(resetState);
  resetStateRef.current = resetState;

  useEffect(() => {
    resetStateRef.current?.();
    setChatMessages([]);
    setChatMessagesLoaded(false);
    messagesLoadedRef.current = false;
    void loadWorkspace();
  }, [loadWorkspace]);

  return {
    workspaceId,
    workspaceName,
    setWorkspaceName,
    loading,
    error,
    setError,
    chatMessages,
    setChatMessages,
    chatMessagesLoaded,
    refreshWorkspace,
    handleRename,
  };
}
