"use client";

import { SubagentWorkspaceList } from "@dude/chat/subagents/subagent-workspace-list";

export default function DataAnalystSubagentPage() {
  return (
    <SubagentWorkspaceList
      subagentId="data-analyst"
      title="Data analyst"
      subtitle="Turn raw data into decisions"
      emptyTitle="No workspaces yet"
      emptyDescription="Create a named workspace to start a task."
    />
  );
}
