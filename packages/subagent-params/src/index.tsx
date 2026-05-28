"use client";

import { createContext, useContext } from "react";
import { useParams as useRouterParams } from "react-router-dom";

const SpecialistParamsContext = createContext<{
  workspaceId?: string;
  isEmbedded?: boolean;
} | null>(null);

export function SpecialistParamsProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  return (
    <SpecialistParamsContext.Provider value={{ workspaceId, isEmbedded: true }}>
      {children}
    </SpecialistParamsContext.Provider>
  );
}

/**
 * Returns the workspaceId from either:
 * 1. SpecialistParamsContext (when rendered inline, e.g. in the canvas side panel)
 * 2. Next.js route params (when rendered as a normal page)
 */
export function useWorkspaceId(): string {
  const ctx = useContext(SpecialistParamsContext);
  const params = useRouterParams();

  if (ctx?.workspaceId) return ctx.workspaceId;

  const fromParams = params?.workspaceId;
  return typeof fromParams === "string" ? fromParams : "";
}

/**
 * Returns true when the subagent page is rendered inside the canvas
 * (i.e. wrapped by SpecialistParamsProvider) rather than as a standalone page.
 */
export function useIsEmbedded(): boolean {
  const ctx = useContext(SpecialistParamsContext);
  return ctx?.isEmbedded === true;
}
