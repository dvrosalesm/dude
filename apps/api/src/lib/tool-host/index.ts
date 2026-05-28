export {
  buildToolsForSubagent,
  buildSubagentSetup,
  getSubagentForGateway,
  getSubagentMeta,
  resolveSubagentDeclaration,
} from "./registry.js";

export { buildToolHostCatalog } from "./catalog.js";
export { executeHostedTool } from "./execute.js";
export {
  parseToolHostSessionFromHeaders,
  toolHostEnvExtrasFromHeaders,
  withToolHostSession,
  type ToolHostSession,
} from "./session.js";
