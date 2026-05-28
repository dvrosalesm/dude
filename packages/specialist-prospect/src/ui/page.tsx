"use client";

import { SpecialistWorkspaceList } from "@dude/chat/specialists/specialist-workspace-list";

export default function ProspectSpecialistPage() {
  return (
    <SpecialistWorkspaceList
      specialistId="prospect"
      title="Website Specialist"
      subtitle="Build websites, funnels, lead capture flows, and analytics with AI"
      emptyTitle="No website workspaces yet"
      emptyDescription="Create a workspace to start building websites, funnels, lead capture flows, and analytics."
    />
  );
}
