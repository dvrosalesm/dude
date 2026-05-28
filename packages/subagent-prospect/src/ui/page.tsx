"use client";

import { SubagentWorkspaceList } from "@dude/chat/subagents/subagent-workspace-list";

export default function ProspectSubagentPage() {
  return (
    <SubagentWorkspaceList
      subagentId="prospect"
      title="Website Subagent"
      subtitle="Build websites, funnels, lead capture flows, and analytics with AI"
      emptyTitle="No website workspaces yet"
      emptyDescription="Create a workspace to start building websites, funnels, lead capture flows, and analytics."
    />
  );
}
