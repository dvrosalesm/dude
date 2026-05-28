"use client";

import { SpecialistWorkspaceList } from "@dude/chat/specialists/specialist-workspace-list";

export default function DataAnalystSpecialistPage() {
  return (
    <SpecialistWorkspaceList
      specialistId="data-analyst"
      title="Data analyst"
      subtitle="Turn raw data into decisions"
      emptyTitle="No workspaces yet"
      emptyDescription="Create a named workspace to start a task."
    />
  );
}
