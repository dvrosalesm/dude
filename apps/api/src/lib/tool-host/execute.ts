import type {
  AgentToolHostExecuteRequest,
  AgentToolHostExecuteResponse,
} from "@dude/sdk/runner";
import { buildToolsForSubagent, getSubagentMeta } from "./registry.js";
import {
  type ToolHostSession,
  withToolHostSession,
} from "./session.js";

export async function executeHostedTool(
  session: ToolHostSession,
  body: AgentToolHostExecuteRequest,
  envExtras?: Record<string, string | undefined>,
): Promise<AgentToolHostExecuteResponse> {
  const { tool, toolCallId, arguments: args } = body;
  if (!tool?.trim()) {
    throw new Error("tool is required");
  }
  if (!toolCallId?.trim()) {
    throw new Error("toolCallId is required");
  }

  const meta = getSubagentMeta(session.subagentId);

  return withToolHostSession(session, envExtras, async () => {
    const tools = buildToolsForSubagent(meta.subagentId, {
      runner: session.runner,
    });
    const definition = tools.find((entry) => entry.name === tool);
    if (!definition) {
      throw new Error(`Unknown tool "${tool}" for subagent "${meta.subagentId}"`);
    }

    return definition.execute(toolCallId, args ?? {});
  });
}
