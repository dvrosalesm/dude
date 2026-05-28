"use client";

import { SpecialistWorkspaceList } from "@dude/chat/specialists/specialist-workspace-list";

export default function DocumentWriterSpecialistPage() {
  return (
    <SpecialistWorkspaceList
      specialistId="document-writer"
      title="Document Writer"
      subtitle="Write documents with AI assistance"
      emptyTitle="No workspaces yet"
      emptyDescription="Create a workspace to start writing documents."
    />
  );
}
