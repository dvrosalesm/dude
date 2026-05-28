import hostConfig from "../../../../subagents.config.client";
import { createSubagentRegistry } from "@dude/sdk";
import type { SubagentId, SubagentSummary } from "../types";

type SubagentRegistry = ReturnType<typeof createSubagentRegistry>;

let specialistRegistry: SubagentRegistry | null = null;

export function getSubagentRegistry(): SubagentRegistry {
  specialistRegistry ??= createSubagentRegistry(hostConfig);
  return specialistRegistry;
}

function buildSpecialistsList(): SubagentSummary[] {
  return getSubagentRegistry().list().map((plugin) => {
    const summary = plugin.local?.summary;
    return {
      id: plugin.path as SubagentId,
      name: summary?.name ?? plugin.manifest.gatewayLabel,
      handle: summary?.handle ?? plugin.id.toUpperCase().slice(0, 4),
      scope: summary?.scope ?? plugin.manifest.gatewayDescription,
      status: summary?.status ?? "ready",
    };
  });
}

let cachedSpecialists: SubagentSummary[] | null = null;

function getSpecialistsList(): SubagentSummary[] {
  cachedSpecialists ??= buildSpecialistsList();
  return cachedSpecialists;
}

export const SUBAGENTS: SubagentSummary[] = new Proxy([] as SubagentSummary[], {
  get(_target, prop) {
    const list = getSpecialistsList();
    const value = list[prop as keyof SubagentSummary[]];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(list);
    }
    return value;
  },
});
