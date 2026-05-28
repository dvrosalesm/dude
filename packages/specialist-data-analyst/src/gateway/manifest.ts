import type { SpecialistGatewayConfig } from "@dude/sdk";
import { declaration } from "./declaration-source.js";

export const skillPaths = declaration.skillPaths ?? [];

export const gatewayManifest: SpecialistGatewayConfig = {
  declaration,
  skillPaths,
};
