import type {
  AgentDispatchRequest,
  AgentToolHostCatalogResponse,
  AgentToolHostExecuteResponse,
} from "@dude/sdk/runner";
import { buildToolHostCatalog } from "../tool-host/catalog.js";
import { executeHostedTool } from "../tool-host/execute.js";
import type { ToolHostSession } from "../tool-host/session.js";

export type { AgentDispatchRequest };

export async function buildAgentCatalog(
  session: ToolHostSession,
  envExtras?: Record<string, string | undefined>,
): Promise<AgentToolHostCatalogResponse> {
  return buildToolHostCatalog(session, envExtras);
}

export async function dispatchAgentAction(
  session: ToolHostSession,
  body: AgentDispatchRequest,
  envExtras?: Record<string, string | undefined>,
): Promise<AgentToolHostExecuteResponse> {
  const action = body.action?.trim();
  if (!action) {
    throw new Error("action is required");
  }

  return executeHostedTool(
    session,
    {
      tool: action,
      toolCallId: body.callId?.trim() || `dispatch-${Date.now()}`,
      arguments: body.payload ?? {},
    },
    envExtras,
  );
}
