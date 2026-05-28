"use client";

import { SpecialistWorkspaceList } from "@dude/chat/specialists/specialist-workspace-list";

export default function DesignBrandingSpecialistPage() {
  return (
    <SpecialistWorkspaceList
      specialistId="design-branding"
      title="Design Studio"
      subtitle="Brand, mockups, and mood boards on one canvas"
      emptyTitle="No design canvases yet"
      emptyDescription="Create a workspace to start designing."
    />
  );
}
