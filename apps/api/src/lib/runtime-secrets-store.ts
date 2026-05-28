import type { RuntimeSecrets } from "./runtime-config.js";

const byWorkspace = new Map<string, RuntimeSecrets>();
const byOrganization = new Map<string, RuntimeSecrets>();

let instanceSecretsProvider:
  | ((workspaceId: string) => RuntimeSecrets | undefined)
  | null = null;

let spawnFileSecretsProvider:
  | ((workspaceId: string, organizationId: string) => RuntimeSecrets | undefined)
  | null = null;

export function registerInstanceRuntimeSecretsProvider(
  provider: (workspaceId: string) => RuntimeSecrets | undefined,
) {
  instanceSecretsProvider = provider;
}

export function registerSpawnFileRuntimeSecretsProvider(
  provider: (workspaceId: string, organizationId: string) => RuntimeSecrets | undefined,
) {
  spawnFileSecretsProvider = provider;
}

export function setWorkspaceRuntimeSecrets(
  workspaceId: string,
  organizationId: string,
  secrets: RuntimeSecrets,
) {
  byWorkspace.set(workspaceId, secrets);
  byOrganization.set(organizationId, secrets);
}

export function clearWorkspaceRuntimeSecrets(workspaceId: string) {
  byWorkspace.delete(workspaceId);
}

export function getWorkspaceRuntimeSecrets(
  workspaceId: string,
): RuntimeSecrets | undefined {
  return byWorkspace.get(workspaceId);
}

export function ensureWorkspaceRuntimeSecrets(
  workspaceId: string,
  organizationId = "local",
): RuntimeSecrets | undefined {
  const cached = byWorkspace.get(workspaceId);
  if (cached?.apiKey) return cached;

  const fromInstance = instanceSecretsProvider?.(workspaceId);
  if (fromInstance?.apiKey) {
    setWorkspaceRuntimeSecrets(workspaceId, organizationId, fromInstance);
    return fromInstance;
  }

  const fromSpawn = spawnFileSecretsProvider?.(workspaceId, organizationId);
  if (fromSpawn?.apiKey) {
    return fromSpawn;
  }

  return cached ?? fromInstance ?? fromSpawn;
}

export function getOrganizationRuntimeSecrets(
  organizationId: string,
): RuntimeSecrets | undefined {
  return byOrganization.get(organizationId);
}
