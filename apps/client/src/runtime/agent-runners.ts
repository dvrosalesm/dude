import type { AgentRunnerManifest } from "@dude/sdk/runner";
import {
  isBuiltinRunnerId,
  listAgentRunners,
  registerAgentRunnerManifest,
} from "@dude/sdk/runner";
import { gatewayRequest } from "./gateway-desktop";

type ServerRunnerListing = AgentRunnerManifest & {
  available?: boolean;
  serverEntry?: string;
};

let syncPromise: Promise<void> | null = null;

export async function syncAgentRunnersFromApi(): Promise<void> {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      const response = await gatewayRequest<{ runners: ServerRunnerListing[] }>(
        "/runners",
      );

      for (const runner of response.runners) {
        if (isBuiltinRunnerId(runner.id)) continue;
        registerAgentRunnerManifest({
          id: runner.id,
          label: runner.label,
          description: runner.description,
          availability: runner.availability,
          harnessKind: runner.harnessKind,
          installHint: runner.installHint,
          homepage: runner.homepage,
        });
      }
    } catch {
      // API offline — built-ins still work from the SDK bundle.
    }
  })();

  return syncPromise;
}

export function listAvailableAgentRunners(): AgentRunnerManifest[] {
  return listAgentRunners();
}
