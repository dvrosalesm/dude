import { httpError } from "../../http-error.js";
import { getWorkspaceConfig } from "./workspace-config.js";

/**
 * GET /v1/internal/workspace/:workspaceId/config
 */
export async function getConfig(workspaceId: string) {
  try {
    const config = await getWorkspaceConfig(workspaceId);
    return {
      accounts: ((config.accounts as Record<string, unknown>[]) || []).map((a) => ({
        id: a.id,
        platform: a.platform,
        handle: a.handle || a.displayName,
        connected: a.connected,
      })),
      campaigns: ((config.campaigns as Record<string, unknown>[]) || []).map((c) => ({
        id: c.id,
        name: c.name,
        goal: c.goal,
        platforms: c.platforms,
        active: c.active,
      })),
      plans: ((config.plans as Record<string, unknown>[]) || []).map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        platforms: p.platforms,
        campaignId: p.campaignId,
      })),
      researchRuns: ((config.researchRuns as unknown[]) || []).length,
      brandResearch: config.brandResearch ? true : false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read config";
    throw httpError(message, 500);
  }
}
