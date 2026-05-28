import type { AgentToolHostCatalogResponse } from "@dude/sdk/runner";
import type { GatewayMessage } from "./adapter-http.js";

export type HostedChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

export interface BuildHostedMessagesInput {
  message: string;
  history?: GatewayMessage[];
  images?: string[];
  systemPrompt?: string;
}

export function buildHostedUserContent(message: string, images?: string[]): string {
  const trimmed = message.trim();
  if (!images?.length) return trimmed;

  const imageLines = images.map(
    (url, index) => `[Attached image ${index + 1}]: ${url}`,
  );
  return `${trimmed}\n\n${imageLines.join("\n")}`;
}

export function buildSkillPackHint(skillPaths: string[]): string {
  if (!skillPaths.length) return "";

  const names = skillPaths.map((entry) => {
    const parts = entry.split(/[/\\]/).filter(Boolean);
    return parts[parts.length - 1] ?? entry;
  });

  return (
    `\n\nSpecialist skill packs: ${names.join(", ")}. ` +
    "Use the registered tools to read and update the workspace; " +
    "follow these workflows for multi-step subagent tasks."
  );
}

export function buildHostedSystemPrompt(
  catalog: AgentToolHostCatalogResponse,
  systemPrompt?: string,
): string {
  const base =
    systemPrompt?.trim() ||
    process.env.SYSTEM_PROMPT?.trim() ||
    "You are a helpful assistant with access to tools.";

  const toolNames = catalog.tools.map((tool) => tool.name).join(", ");
  const toolHint = toolNames
    ? `\n\nYou have ${catalog.tools.length} tools: ${toolNames}. ` +
      "Use them to complete subagent work. Call finish_turn when done."
    : "";

  return `${base}${buildSkillPackHint(catalog.skillPaths)}${toolHint}`;
}

export function buildHostedConversationMessages(
  input: BuildHostedMessagesInput,
  catalog: AgentToolHostCatalogResponse,
): HostedChatMessage[] {
  const messages: HostedChatMessage[] = [
    {
      role: "system",
      content: buildHostedSystemPrompt(catalog, input.systemPrompt),
    },
  ];

  for (const row of input.history ?? []) {
    if (row.role === "user" || row.role === "assistant") {
      messages.push({ role: row.role, content: row.content });
    }
  }

  messages.push({
    role: "user",
    content: buildHostedUserContent(input.message, input.images),
  });

  return messages;
}
