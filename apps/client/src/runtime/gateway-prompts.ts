"use client";

import { getDelegableSubagents } from "@dude/sdk";
import { buildDocumentWriterSystemPromptAppendix } from "@dude/subagent-document-writer/gateway/document-authoring-guidelines";
import { buildPresentationEditorSystemPromptAppendix } from "@dude/subagent-document-editor/gateway/slide-authoring-guidelines";
import {
  normalizeRunnerSettings,
  resolvePiRunnerSettings,
} from "@dude/sdk/runner";
import type { SubagentId } from "../types";
import {
  parseLocalAppConfigurations,
  readStoredPreferences,
} from "../preferences";
import { SUBAGENTS, getSubagentRegistry } from "./subagent-list";

export function buildAppConfigurationsPrompt(appConfigurations: ReturnType<typeof parseLocalAppConfigurations>) {
  const enabledServers = appConfigurations.mcpServers.filter(
    (server) => server.enabled !== false,
  );
  const enabledTools = appConfigurations.sourceTools.filter(
    (tool) => tool.enabled !== false,
  );
  const enabledSkills = appConfigurations.skills.filter(
    (skill) => skill.enabled !== false,
  );
  if (!enabledServers.length && !enabledTools.length && !enabledSkills.length) {
    return "";
  }

  const lines = [
    "",
    "## App Configurations",
    "The user configured these MCP servers, source tools, and skills at the app level. Use them when relevant to the task.",
  ];
  if (enabledServers.length) {
    lines.push("", "### MCP Servers");
    for (const server of enabledServers) {
      lines.push(
        `- ${String(server.name ?? "Unnamed MCP")} (${String(server.transport ?? "http")})`,
      );
    }
  }
  if (enabledTools.length) {
    lines.push("", "### Source Tools");
    for (const tool of enabledTools) {
      lines.push(
        `- ${String(tool.name ?? "unnamed_tool")}: ${String(tool.description ?? "No description")}`,
      );
    }
  }
  if (enabledSkills.length) {
    lines.push("", "### Skills");
    for (const skill of enabledSkills) {
      const trigger = skill.trigger ? ` Trigger: ${skill.trigger}` : "";
      const reference = skill.reference ? ` Reference: ${skill.reference}` : "";
      lines.push(
        `- ${String(skill.name ?? "Unnamed skill")}: ${String(skill.description ?? "No description")}${trigger}${reference}`,
      );
      if (skill.instructions) {
        lines.push(`  Instructions: ${String(skill.instructions).slice(0, 500)}`);
      }
    }
  }
  return lines.join("\n");
}

function buildAgenticAppSetupPrompt() {
  return [
    "",
    "## Agentic App Capability Setup",
    "When the user asks to add, install, configure, find, remove, or set up MCP servers, source tools, or skills, do the setup yourself instead of sending them to a manual settings form.",
    "Use the existing workspace tools as the install channel:",
    "",
    "1. Call `workspace_read` with collection `gtSession`.",
    "2. Call `workspace_save` with collection `gtSession`, preserving any existing gtSession fields and setting `appConfigurationRequests` to an array of pending requests.",
    "3. The host app applies those requests after your turn and appends the setup result to your reply.",
    "",
    "Request schema: `{ \"action\": \"list\" | \"find_skill\" | \"upsert\" | \"remove\", \"kind\": \"mcp_server\" | \"source_tool\" | \"skill\", \"query\"?: string, \"id\"?: string, \"config\"?: object }`.",
    "MCP server config fields: `{ id?, name, transport: \"http\" | \"sse\" | \"stdio\", url?, command?, args?, env?, enabled? }`.",
    "Source tool config fields: `{ id?, name, description, endpoint?, schema?, enabled? }`.",
    "Skill config fields: `{ id?, name, description, source: \"registry\" | \"local\" | \"github\" | \"inline\", reference?, trigger?, instructions?, config?, enabled? }`.",
    "Use `find_skill` when the user asks for a skill by purpose or name and you need to search the local skill catalog. For a clear install request, use `upsert` directly.",
    "Do not invent API keys, tokens, passwords, or secret environment values. If required secrets are missing, install the non-secret parts and say what value is still needed.",
  ].join("\n");
}

const DUDE_UI_MODE_INSTRUCTIONS = `DUDE UI MODE

You are running inside the Dude desktop/web UI — the user can see your work and respond inline.

All confirmations, approval prompts, clarifying questions, and choices MUST go through the \`ui_request_input\` tool. Do NOT ask the user to reply in chat when this tool is available, assume silent approval, or invent answers on the user's behalf.

Use kind \`confirm\` for yes/no, \`question\` for free text, and \`choice\` for multiple options. Wait for the tool result before continuing.`;

function buildSystemPrompt(subagentId: SubagentId, appConfigurations: ReturnType<typeof parseLocalAppConfigurations>) {
  if (subagentId === "main-assistant") {
    return [
      "You are Dude, the local assistant inside Dude.",
      "The assistant's default display name is Dude, but the user may rename it in preferences.",
      "You help the user perform local-first work, handle quick tasks yourself (including images via generate_image), and route specialized work to subagent workspaces.",
      "Use generate_image directly for simple visuals in chat; delegate to design-branding only for canvas brand systems, palettes, and multi-asset brand work.",
      "Be concise, practical, and clear. Mention when a task needs a specific subagent or API key.",
      "Do not claim to access cloud services unless the user configured a provider key.",
      buildAgenticAppSetupPrompt(),
      buildAppConfigurationsPrompt(appConfigurations),
    ].join("\n");
  }

  const subagent = SUBAGENTS.find((item) => item.id === subagentId);
  return [
    `You are the ${subagent?.name ?? "subagent"} inside Dude.`,
    subagent?.scope ? `Your scope: ${subagent.scope}.` : "",
    "Run locally where possible, ask for missing inputs, and keep responses action-oriented.",
    subagentId === "document-writer" ? buildDocumentWriterSystemPromptAppendix() : "",
    subagentId === "presentation-editor"
      ? buildPresentationEditorSystemPromptAppendix()
      : "",
    buildAppConfigurationsPrompt(appConfigurations),
    DUDE_UI_MODE_INSTRUCTIONS,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildGatewayConfig(subagentId: SubagentId) {
  const preferences = readStoredPreferences();
  const appConfigurations = parseLocalAppConfigurations(
    preferences.appConfigurations,
  );
  const enabledMcpServers = appConfigurations.mcpServers.filter(
    (server) => server.enabled !== false,
  );
  const enabledSourceTools = appConfigurations.sourceTools.filter(
    (tool) => tool.enabled !== false,
  );
  const enabledSkills = appConfigurations.skills.filter(
    (skill) => skill.enabled !== false,
  );

  const isMainAssistant = subagentId === "main-assistant";
  const delegableSpecialists = getDelegableSubagents(getSubagentRegistry()).map(
    (subagent) => {
      const plugin = getSubagentRegistry().getById(subagent.id);
      const scope = plugin?.local?.summary.scope?.trim();
      return {
        id: subagent.id,
        label: subagent.gatewayLabel,
        description: [subagent.gatewayDescription, scope]
          .filter(Boolean)
          .join(scope ? " — " : ""),
      };
    },
  );
  const runnerSettings = normalizeRunnerSettings(preferences.runnerConfigs);
  const piSettings = resolvePiRunnerSettings(
    {
      runner: preferences.agentRunner,
      provider: preferences.runtime.provider,
      systemPrompt: "",
      tools: [],
      runnerSettings,
      maxIterations: runnerSettings.pi?.maxIterations,
      approvalMode: runnerSettings.pi?.approvalMode,
    },
    { isMainAssistant },
  );

  return {
    runner: preferences.agentRunner,
    provider: {
      kind: preferences.runtime.provider.kind,
      model: preferences.runtime.provider.model,
      ...(preferences.runtime.provider.endpoint
        ? { endpoint: preferences.runtime.provider.endpoint }
        : {}),
    },
    credentials: preferences.runtime.credentials,
    runnerSettings,
    systemPrompt: buildSystemPrompt(subagentId, appConfigurations),
    tools: [],
    ...(enabledMcpServers.length > 0 ? { mcpServers: enabledMcpServers } : {}),
    ...(enabledSourceTools.length > 0 ? { sourceTools: enabledSourceTools } : {}),
    ...(enabledSkills.length > 0 ? { skills: enabledSkills } : {}),
    maxIterations: piSettings.maxIterations,
    approvalMode: piSettings.approvalMode,
    enabledSpecialists: isMainAssistant ? delegableSpecialists : [],
  };
}
