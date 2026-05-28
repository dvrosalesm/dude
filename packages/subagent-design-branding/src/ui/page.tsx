"use client";

import { SubagentWorkspaceList } from "@dude/chat/subagents/subagent-workspace-list";

export default function DesignBrandingSubagentPage() {
  return (
    <SubagentWorkspaceList
      subagentId="design-branding"
      title="Design Studio"
      subtitle="Brand, mockups, and mood boards on one canvas"
      emptyTitle="No design canvases yet"
      emptyDescription="Create a workspace to start designing."
    />
  );
}
