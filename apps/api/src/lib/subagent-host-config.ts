import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { SubagentHostConfig } from "@dude/sdk";

const require = createRequire(import.meta.url);
const specialistsConfigPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../subagents.config.ts",
);

let cached: SubagentHostConfig | null = null;

/** Lazy-load root host config after the module graph settles (avoids ESM cycles). */
export function getSubagentHostConfig(): SubagentHostConfig {
  if (cached) return cached;

  const mod = require(specialistsConfigPath) as {
    default?: SubagentHostConfig;
  };
  const config = mod.default ?? (mod as unknown as SubagentHostConfig);
  if (!Array.isArray(config.subagents)) {
    throw new Error(
      "subagents.config.ts did not export a valid SubagentHostConfig",
    );
  }

  cached = config;
  return cached;
}
