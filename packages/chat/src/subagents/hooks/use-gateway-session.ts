"use client";

import type { SubagentId } from "@dude/client-types";
import {
  clearGatewaySessionId,
  readGatewaySessionId,
  writeGatewaySessionId,
} from "../../lib/gateway-session";

/**
 * Gateway session persistence via localStorage.
 * Each subagent + workspace gets its own session key.
 */
export function useGatewaySession(
  subagentId: string,
  workspaceId: string | undefined,
) {
  const typedSubagentId = subagentId as SubagentId;

  function getSessionId(): string | undefined {
    if (!workspaceId) return undefined;
    return readGatewaySessionId(typedSubagentId, workspaceId);
  }

  function saveSessionId(sessionId: string) {
    if (!workspaceId) return;
    writeGatewaySessionId(typedSubagentId, sessionId, workspaceId);
  }

  function clearSessionId() {
    clearGatewaySessionId(typedSubagentId, workspaceId);
  }

  return { getSessionId, saveSessionId, clearSessionId };
}
