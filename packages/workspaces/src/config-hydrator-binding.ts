let workspaceConfigHydrator:
  | ((
      workspaceId: string,
      configurations: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>)
  | null = null;

export function bindWorkspaceConfigHydrator(
  hydrator: typeof workspaceConfigHydrator,
): void {
  workspaceConfigHydrator = hydrator;
}

export async function hydrateWorkspaceConfigurations(
  workspaceId: string,
  configurations: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!workspaceConfigHydrator) return configurations;
  try {
    return await workspaceConfigHydrator(workspaceId, configurations);
  } catch {
    return configurations;
  }
}
