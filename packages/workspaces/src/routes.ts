import type { SpecialistId } from "@dude/client-types";

export function specialistListPath(specialistId: SpecialistId | string) {
  return `/chat/specialists/${specialistId}`;
}

export function specialistWorkspacePath(
  specialistId: SpecialistId | string,
  workspaceId: string,
) {
  return `/chat/specialists/${specialistId}/${workspaceId}`;
}
