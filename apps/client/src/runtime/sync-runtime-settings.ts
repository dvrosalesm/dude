import type { DudePreferences } from "../preferences";
import { canUseGateway, gatewayRequest } from "./gateway-desktop";

/** Mirror Settings → AI Runners to API SQLite for harness / subagent-run. */
export async function syncRuntimeSettingsToApi(
  preferences: DudePreferences,
): Promise<void> {
  if (!canUseGateway()) return;

  try {
    await gatewayRequest("/internal/assistant/runtime-settings", {
      method: "POST",
      body: {
        agentRunner: preferences.agentRunner,
        credentials: preferences.runtime.credentials,
        runnerSettings: preferences.runnerConfigs,
      },
      timeoutMs: 10_000,
    });
  } catch (error) {
    console.warn(
      "[dude] Failed to sync runtime settings to API:",
      error instanceof Error ? error.message : error,
    );
  }
}
