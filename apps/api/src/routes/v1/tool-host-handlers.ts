import {
  buildToolHostCatalog,
  executeHostedTool,
  parseToolHostSessionFromHeaders,
  toolHostEnvExtrasFromHeaders,
} from "../../lib/tool-host/index.js";
import type { AgentToolHostExecuteRequest } from "@dude/sdk/runner";

export async function getToolHostCatalog(request: Request) {
  const session = parseToolHostSessionFromHeaders(request.headers);
  if (!session) {
    return Response.json(
      {
        error:
          "Missing session headers: x-workspace-id, x-specialist-id, x-organization-id",
      },
      { status: 400 },
    );
  }

  const catalog = await buildToolHostCatalog(
    session,
    toolHostEnvExtrasFromHeaders(request.headers),
  );
  return Response.json(catalog);
}

export async function postToolHostExecute(request: Request) {
  const session = parseToolHostSessionFromHeaders(request.headers);
  if (!session) {
    return Response.json(
      {
        error:
          "Missing session headers: x-workspace-id, x-specialist-id, x-organization-id",
      },
      { status: 400 },
    );
  }

  let body: AgentToolHostExecuteRequest;
  try {
    body = (await request.json()) as AgentToolHostExecuteRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await executeHostedTool(
      session,
      body,
      toolHostEnvExtrasFromHeaders(request.headers),
    );
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[tool-host] execute error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
