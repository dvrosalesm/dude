/**
 * Codex app-server dynamic tools — registers subagent actions on thread/start
 * and executes them in-process via RunnerSessionManifest (no curl/shell).
 */

import type { AgentToolHostCatalogResponse } from "@dude/sdk/runner";
import {
  buildPresentationNativeRunnerAppendix,
  isDocumentEditorSpecialist,
} from "@dude/subagent-document-editor/gateway/slide-authoring-guidelines";
import {
  buildDocumentWriterNativeRunnerAppendix,
  isDocumentWriterSpecialist,
} from "@dude/subagent-document-writer/gateway/document-authoring-guidelines";
import {
  dispatchViaManifest,
  loadRunnerSessionManifestFromEnv,
  type RunnerSessionManifest,
} from "../runner-session-manifest.js";
import {
  fetchAgentCatalog,
  type ToolHostClientConfig,
} from "./tool-host-client.js";

export interface CodexDynamicToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  namespace?: string;
  deferLoading?: boolean;
}

const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const DUDE_DYNAMIC_TOOL_NAMESPACE = "dude";

function toolHostConfigFromManifest(
  manifest: RunnerSessionManifest,
): ToolHostClientConfig {
  return {
    baseUrl: manifest.internalApi.baseUrl,
    workspaceId: manifest.workspaceId,
    subagentId: manifest.subagentId,
    organizationId: manifest.organizationId,
    runner: manifest.runner,
  };
}

function toolResultText(result: {
  content: Array<{ type: string; text?: string }>;
}): string {
  return result.content
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n");
}

let cachedCatalog: AgentToolHostCatalogResponse | null = null;
let cachedManifestSessionId: string | null = null;

export function requireRunnerSessionManifest(): RunnerSessionManifest {
  const manifest = loadRunnerSessionManifestFromEnv();
  if (!manifest) {
    throw new Error(
      "Runner session manifest missing (.dude-runner-session.json). Restart the agent instance.",
    );
  }
  return manifest;
}

export async function loadCodexDynamicToolCatalog(
  manifest: RunnerSessionManifest,
): Promise<AgentToolHostCatalogResponse> {
  if (
    cachedCatalog &&
    cachedManifestSessionId === manifest.sessionId
  ) {
    return cachedCatalog;
  }

  const catalog = await fetchAgentCatalog(toolHostConfigFromManifest(manifest));
  cachedCatalog = catalog;
  cachedManifestSessionId = manifest.sessionId;
  return catalog;
}

export function catalogToDynamicTools(
  catalog: AgentToolHostCatalogResponse,
): CodexDynamicToolSpec[] {
  const tools: CodexDynamicToolSpec[] = [];

  for (const tool of catalog.tools) {
    const name = tool.name.trim();
    if (!TOOL_NAME_PATTERN.test(name)) {
      console.warn(
        `[codex-dynamic-tools] Skipping tool "${name}" — invalid dynamic tool name`,
      );
      continue;
    }

    tools.push({
      name,
      description: tool.description,
      inputSchema:
        tool.parameters && typeof tool.parameters === "object"
          ? (tool.parameters as Record<string, unknown>)
          : { type: "object", properties: {} },
      namespace: DUDE_DYNAMIC_TOOL_NAMESPACE,
    });
  }

  return tools;
}

export async function buildCodexDynamicToolsForThread(): Promise<CodexDynamicToolSpec[]> {
  const manifest = requireRunnerSessionManifest();
  const catalog = await loadCodexDynamicToolCatalog(manifest);
  return catalogToDynamicTools(catalog);
}

export interface DynamicToolCallParams {
  threadId: string;
  turnId: string;
  callId: string;
  tool: string;
  arguments: Record<string, unknown>;
  namespace?: string | null;
}

export interface DynamicToolCallResponse {
  success: boolean;
  contentItems: Array<
    | { type: "inputText"; text: string }
    | { type: "inputImage"; imageUrl: string }
  >;
}

export async function executeCodexDynamicToolCall(
  params: DynamicToolCallParams,
): Promise<DynamicToolCallResponse> {
  const namespace = params.namespace?.trim() || DUDE_DYNAMIC_TOOL_NAMESPACE;
  if (namespace !== DUDE_DYNAMIC_TOOL_NAMESPACE) {
    return {
      success: false,
      contentItems: [
        {
          type: "inputText",
          text: `Unsupported dynamic tool namespace "${namespace}" (expected ${DUDE_DYNAMIC_TOOL_NAMESPACE})`,
        },
      ],
    };
  }

  const manifest = requireRunnerSessionManifest();
  const toolName = params.tool?.trim();
  if (!toolName) {
    return {
      success: false,
      contentItems: [{ type: "inputText", text: "tool name is required" }],
    };
  }

  try {
    const result = await dispatchViaManifest(manifest, {
      action: toolName,
      payload: params.arguments ?? {},
      callId: params.callId,
    });

    const text = toolResultText(result);
    return {
      success: true,
      contentItems: [{ type: "inputText", text: text || "{}" }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[codex-dynamic-tools] ${toolName} failed:`, message);
    return {
      success: false,
      contentItems: [{ type: "inputText", text: message }],
    };
  }
}

export function buildCodexDynamicToolsPromptAppendix(
  catalog: AgentToolHostCatalogResponse,
): string {
  const names = catalog.tools.map((tool) => tool.name).join(", ");
  let appendix =
    `\n\n<dude_specialist_tools>\n` +
    `Subagent tools are registered as native Codex dynamic tools (namespace: dude).\n` +
    `Call them directly — do NOT use curl, shell, or HTTP clients for workspace actions.\n` +
    `Available: ${names}\n` +
    `Call finish_turn when the task is complete.\n` +
    `</dude_specialist_tools>`;

  if (isDocumentEditorSpecialist(catalog.session.subagentId)) {
    appendix += buildPresentationNativeRunnerAppendix(names);
  }
  if (isDocumentWriterSpecialist(catalog.session.subagentId)) {
    appendix += buildDocumentWriterNativeRunnerAppendix(names);
  }

  return appendix;
}

export function resetCodexDynamicToolCacheForTests(): void {
  cachedCatalog = null;
  cachedManifestSessionId = null;
}
