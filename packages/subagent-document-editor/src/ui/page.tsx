"use client";

import { SubagentWorkspaceList } from "@dude/chat/subagents/subagent-workspace-list";

export default function PresentationEditorSubagentPage() {
  return (
    <SubagentWorkspaceList
      subagentId="presentation-editor"
      title="Presentation Editor"
      subtitle="Edit presentations with AI assistance"
      emptyTitle="No workspaces yet"
      emptyDescription="Create a workspace to start editing presentations."
    />
  );
}
