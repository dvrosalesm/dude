import type { SubagentGatewayConfig } from "@dude/sdk";
import { declaration } from "./declaration-source.js";

export const skillPaths = declaration.skillPaths ?? [];

export const gatewayManifest: SubagentGatewayConfig = {
  declaration,
  skillPaths,
};
