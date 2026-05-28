import hostConfig from "../../../../specialists.config.client";
import { createSpecialistRegistry } from "@dude/sdk";
import type { SpecialistId, SpecialistSummary } from "../types";

type SpecialistRegistry = ReturnType<typeof createSpecialistRegistry>;

let specialistRegistry: SpecialistRegistry | null = null;

export function getSpecialistRegistry(): SpecialistRegistry {
  specialistRegistry ??= createSpecialistRegistry(hostConfig);
  return specialistRegistry;
}

function buildSpecialistsList(): SpecialistSummary[] {
  return getSpecialistRegistry().list().map((plugin) => {
    const summary = plugin.local?.summary;
    return {
      id: plugin.path as SpecialistId,
      name: summary?.name ?? plugin.manifest.gatewayLabel,
      handle: summary?.handle ?? plugin.id.toUpperCase().slice(0, 4),
      scope: summary?.scope ?? plugin.manifest.gatewayDescription,
      status: summary?.status ?? "ready",
    };
  });
}

let cachedSpecialists: SpecialistSummary[] | null = null;

function getSpecialistsList(): SpecialistSummary[] {
  cachedSpecialists ??= buildSpecialistsList();
  return cachedSpecialists;
}

export const SPECIALISTS: SpecialistSummary[] = new Proxy([] as SpecialistSummary[], {
  get(_target, prop) {
    const list = getSpecialistsList();
    const value = list[prop as keyof SpecialistSummary[]];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(list);
    }
    return value;
  },
});
