import { Suspense } from "react";
import { installedSpecialists } from "./installed-specialists";
import { ChatSurface } from "../chat/chat-surface";
import type { SpecialistId } from "../../types";

export function SpecialistListRoute({
  specialistId,
}: {
  specialistId: SpecialistId;
}) {
  const plugin = installedSpecialists.getByPath(specialistId);
  if (!plugin) {
    return <ChatSurface specialistId="main-assistant" />;
  }
  const Component = plugin.ui.ListPage;
  return (
    <Suspense fallback={<LegacyRouteLoading />}>
      <Component />
    </Suspense>
  );
}

export function SpecialistWorkspaceRoute({
  specialistId,
}: {
  specialistId: SpecialistId;
}) {
  const plugin = installedSpecialists.getByPath(specialistId);
  if (!plugin) {
    return <ChatSurface specialistId="main-assistant" />;
  }
  const Component = plugin.ui.WorkspacePage;
  return (
    <Suspense fallback={<LegacyRouteLoading />}>
      <Component />
    </Suspense>
  );
}

export function LegacyRouteLoading() {
  return (
    <div className="dude-dream-bg flex h-full items-center justify-center font-mono text-xs uppercase text-[var(--dude-fog)]">
      Loading workspace
    </div>
  );
}
