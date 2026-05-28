import {
  buildAgentCatalog,
  dispatchAgentAction,
} from "../../lib/agent-dispatch/index.js";
import type { AgentDispatchRequest } from "@dude/sdk/runner";
import {
  RUNNER_SESSION_HEADERS,
  RUNNER_SESSION_MANIFEST_VERSION,
} from "@dude/sdk/runner";
import {
  parseToolHostSessionFromHeaders,
  toolHostEnvExtrasFromHeaders,
  type ToolHostSession,
} from "../../lib/tool-host/index.js";
import { withInternalRequestDb } from "./middleware.js";

function rejectUnsupportedManifestVersion(request: Request): Response | null {
  const raw = request.headers.get(RUNNER_SESSION_HEADERS.manifestVersion)?.trim();
  if (!raw) return null;
  if (raw === String(RUNNER_SESSION_MANIFEST_VERSION)) return null;
  return Response.json(
    { error: `Unsupported runner session manifest version: ${raw}` },
    { status: 400 },
  );
}

function rejectMissingLocalDbPath(
  request: Request,
  session: ToolHostSession,
): Response | null {
  if (session.organizationId !== "local") return null;
  const dbPath = request.headers.get(RUNNER_SESSION_HEADERS.dbLocalPath)?.trim();
  if (dbPath) return null;
  return Response.json(
    {
      error:
        "Missing x-db-local-path — restart the agent instance to refresh the session manifest",
    },
    { status: 400 },
  );
}

export async function getAgentCatalog(request: Request) {
  return withInternalRequestDb(request, async () => {
  const versionError = rejectUnsupportedManifestVersion(request);
  if (versionError) return versionError;

  const session = parseToolHostSessionFromHeaders(request.headers);
  if (!session) {
    return Response.json(
      {
        error:
          "Missing session headers: x-workspace-id, x-subagent-id, x-organization-id",
      },
      { status: 400 },
    );
  }

  const dbError = rejectMissingLocalDbPath(request, session);
  if (dbError) return dbError;

  const catalog = await buildAgentCatalog(
    session,
    toolHostEnvExtrasFromHeaders(request.headers),
  );
  return Response.json(catalog);
  });
}

export async function postAgentDispatch(request: Request) {
  return withInternalRequestDb(request, async () => {
  const versionError = rejectUnsupportedManifestVersion(request);
  if (versionError) return versionError;

  const session = parseToolHostSessionFromHeaders(request.headers);
  if (!session) {
    return Response.json(
      {
        error:
          "Missing session headers: x-workspace-id, x-subagent-id, x-organization-id",
      },
      { status: 400 },
    );
  }

  const dbError = rejectMissingLocalDbPath(request, session);
  if (dbError) return dbError;

  let body: AgentDispatchRequest;
  try {
    body = (await request.json()) as AgentDispatchRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await dispatchAgentAction(
      session,
      body,
      toolHostEnvExtrasFromHeaders(request.headers),
    );
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[agent-dispatch] error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
  });
}
