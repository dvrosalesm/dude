"use client";

import { SpecialistWorkspaceList } from "@dude/chat/specialists/specialist-workspace-list";

export default function PresentationEditorSpecialistPage() {
  return (
    <SpecialistWorkspaceList
      specialistId="presentation-editor"
      title="Presentation Editor"
      subtitle="Edit presentations with AI assistance"
      emptyTitle="No workspaces yet"
      emptyDescription="Create a workspace to start editing presentations."
    />
  );
}
