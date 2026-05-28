export {
  buildToolsForSpecialist,
  buildSpecialistSetup,
  getSpecialistForGateway,
  getSpecialistMeta,
  resolveSpecialistDeclaration,
} from "./registry.js";

export { buildToolHostCatalog } from "./catalog.js";
export { executeHostedTool } from "./execute.js";

export {
  applyToolHostSession,
  parseToolHostSessionFromHeaders,
  restoreToolHostEnv,
  snapshotToolHostEnv,
  toolHostEnvExtrasFromHeaders,
  withToolHostSession,
} from "./session.js";

export type { ToolHostSession } from "./session.js";
