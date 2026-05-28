"use client";

import type { SpecialistId } from "@dude/client-types";
import {
  clearGatewaySessionId,
  readGatewaySessionId,
  writeGatewaySessionId,
} from "../../lib/gateway-session";

/**
 * Gateway session persistence via localStorage.
 * Each specialist + workspace gets its own session key.
 */
export function useGatewaySession(
  specialistId: string,
  workspaceId: string | undefined,
) {
  const typedSpecialistId = specialistId as SpecialistId;

  function getSessionId(): string | undefined {
    if (!workspaceId) return undefined;
    return readGatewaySessionId(typedSpecialistId, workspaceId);
  }

  function saveSessionId(sessionId: string) {
    if (!workspaceId) return;
    writeGatewaySessionId(typedSpecialistId, sessionId, workspaceId);
  }

  function clearSessionId() {
    clearGatewaySessionId(typedSpecialistId, workspaceId);
  }

  return { getSessionId, saveSessionId, clearSessionId };
}
