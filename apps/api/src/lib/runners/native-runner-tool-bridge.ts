import type {
  AgentToolHostCatalogResponse,
} from "@dude/sdk/runner";
import { AGENT_DISPATCH_ROUTES } from "@dude/sdk/runner";
import {
  dispatchViaManifest,
  loadRunnerSessionManifestFromEnv,
  sessionHeadersFromManifest,
  type RunnerSessionManifest,
} from "../runner-session-manifest.js";
import {
  fetchAgentCatalog,
  type ToolHostClientConfig,
} from "./tool-host-client.js";
import {
  buildPresentationNativeRunnerAppendix,
  isDocumentEditorSpecialist,
} from "@dude/specialist-document-editor/gateway/slide-authoring-guidelines";
import {
  buildDocumentWriterNativeRunnerAppendix,
  isDocumentWriterSpecialist,
} from "@dude/specialist-document-writer/gateway/document-authoring-guidelines";

const appendixCache = new Map<string, string>();

function cacheKey(manifest: RunnerSessionManifest): string {
  return `${manifest.sessionId}:${manifest.workspaceId}:${manifest.specialistId}`;
}

function formatActionCatalog(catalog: AgentToolHostCatalogResponse): string {
  return catalog.tools
    .map((tool) => `- **${tool.name}**: ${tool.description}`)
    .join("\n");
}

export function buildNativeRunnerToolAppendix(
  manifest: RunnerSessionManifest,
  catalog: AgentToolHostCatalogResponse,
): string {
  const internalBase = manifest.internalApi.baseUrl.replace(/\/+$/, "");
  const dispatchCmd = manifest.dispatchCli;
  const toolNames = catalog.tools.map((tool) => tool.name).join(", ");

  let appendix =
    `\n\n<dude_specialist_actions>\n` +
    `Specialist: ${catalog.session.specialistId}\n` +
    `Session: ${manifest.sessionId}\n\n` +
    `To run specialist actions, use the typed Dude dispatch CLI ONLY:\n` +
    `  ${dispatchCmd} <action> '<payload-json>'\n\n` +
    `Rules:\n` +
    `- NEVER use curl or HTTP clients for dispatch.\n` +
    `- NEVER call port ${manifest.gatewayPort} for tools — that port is chat-only.\n` +
    `- Tools run on ${internalBase}${AGENT_DISPATCH_ROUTES.dispatch}\n` +
    `- DB path is bound in the session manifest; do not guess paths.\n\n` +
    `List actions:\n` +
    `  ${dispatchCmd} __catalog__ '{}'\n\n` +
    `Available actions:\n${formatActionCatalog(catalog)}\n` +
    `Call finish_turn when the task is complete.\n` +
    `The user only sees the finish_turn answer — never narrate shell commands.\n` +
    `</dude_specialist_actions>`;

  if (isDocumentEditorSpecialist(catalog.session.specialistId)) {
    appendix += buildPresentationNativeRunnerAppendix(toolNames);
  }
  if (isDocumentWriterSpecialist(catalog.session.specialistId)) {
    appendix += buildDocumentWriterNativeRunnerAppendix(toolNames);
  }

  return appendix;
}

export async function getNativeRunnerToolAppendix(
  config?: ToolHostClientConfig,
): Promise<string> {
  const manifest = loadRunnerSessionManifestFromEnv();
  if (!manifest) {
    throw new Error(
      "Runner session manifest missing. Restart the agent instance.",
    );
  }

  const key = cacheKey(manifest);
  const cached = appendixCache.get(key);
  if (cached) return cached;

  const catalog = await fetchAgentCatalog(config ?? toolHostConfigFromManifest(manifest));
  const appendix = buildNativeRunnerToolAppendix(manifest, catalog);
  appendixCache.set(key, appendix);
  return appendix;
}

export function toolHostConfigFromManifest(
  manifest: RunnerSessionManifest,
): ToolHostClientConfig {
  return {
    baseUrl: manifest.internalApi.baseUrl,
    workspaceId: manifest.workspaceId,
    specialistId: manifest.specialistId,
    organizationId: manifest.organizationId,
    runner: manifest.runner,
  };
}

export async function appendNativeRunnerToolsToPrompt(
  systemPrompt: string,
  config?: ToolHostClientConfig,
): Promise<string> {
  const base = systemPrompt.trim();
  const appendix = await getNativeRunnerToolAppendix(config);
  if (!base) return appendix;
  return `${base}${appendix}`;
}

export async function executeNativeRunnerDispatch(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<string> {
  const manifest = loadRunnerSessionManifestFromEnv();
  if (!manifest) {
    throw new Error("Runner session manifest missing");
  }

  if (action === "__catalog__") {
    const catalog = await fetchAgentCatalog(toolHostConfigFromManifest(manifest));
    return JSON.stringify(catalog);
  }

  const result = await dispatchViaManifest(manifest, {
    action,
    payload,
    callId: `native-${Date.now()}`,
  });

  return JSON.stringify(result);
}

export { sessionHeadersFromManifest };
