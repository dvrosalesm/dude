import { Suspense } from "react";
import { installedSubagents } from "./installed-subagents";
import { ChatSurface } from "../chat/chat-surface";
import type { SubagentId } from "../../types";

export function SubagentListRoute({
  subagentId,
}: {
  subagentId: SubagentId;
}) {
  const plugin = installedSubagents.getByPath(subagentId);
  if (!plugin) {
    return <ChatSurface subagentId="main-assistant" />;
  }
  const Component = plugin.ui.ListPage;
  return (
    <Suspense fallback={<LegacyRouteLoading />}>
      <Component />
    </Suspense>
  );
}

export function SubagentWorkspaceRoute({
  subagentId,
}: {
  subagentId: SubagentId;
}) {
  const plugin = installedSubagents.getByPath(subagentId);
  if (!plugin) {
    return <ChatSurface subagentId="main-assistant" />;
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
