import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { SpecialistHostConfig } from "@dude/sdk";

const require = createRequire(import.meta.url);
const specialistsConfigPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../specialists.config.ts",
);

let cached: SpecialistHostConfig | null = null;

/** Lazy-load root host config after the module graph settles (avoids ESM cycles). */
export function getSpecialistHostConfig(): SpecialistHostConfig {
  if (cached) return cached;

  const mod = require(specialistsConfigPath) as {
    default?: SpecialistHostConfig;
  };
  const config = mod.default ?? (mod as unknown as SpecialistHostConfig);
  if (!Array.isArray(config.specialists)) {
    throw new Error(
      "specialists.config.ts did not export a valid SpecialistHostConfig",
    );
  }

  cached = config;
  return cached;
}
