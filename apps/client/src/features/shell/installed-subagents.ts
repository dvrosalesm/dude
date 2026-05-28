import hostConfig from "../../../../../subagents.config.client";
import { createSubagentRegistry } from "@dude/sdk";

export const installedSubagents = createSubagentRegistry(hostConfig);
