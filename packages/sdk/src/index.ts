export {
  defineSubagent,
  defineSubagentHost,
  createSubagentRegistry,
  getManageableSubagents,
  getDelegableSubagents,
  isManageableSubagent,
  resolveManageableSubagentId,
} from "./registry.js";

export type { SubagentRegistry } from "./registry.js";
export * from "./types.js";
