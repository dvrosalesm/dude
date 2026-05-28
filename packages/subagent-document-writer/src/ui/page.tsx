"use client";

import { SubagentWorkspaceList } from "@dude/chat/subagents/subagent-workspace-list";

export default function DocumentWriterSubagentPage() {
  return (
    <SubagentWorkspaceList
      subagentId="document-writer"
      title="Document Writer"
      subtitle="Write documents with AI assistance"
      emptyTitle="No workspaces yet"
      emptyDescription="Create a workspace to start writing documents."
    />
  );
}
