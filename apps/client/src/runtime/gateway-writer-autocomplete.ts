"use client";

import type { SubagentId } from "../types";
import { extractUserFacingMessage } from "@dude/gateway-shared/user-facing-message";
import {
  buildDocumentWriterAutocompleteAppendix,
  buildDocumentWriterAutocompleteUserMessage,
} from "@dude/subagent-document-writer/gateway/document-authoring-guidelines";
import { trimAutocompleteCompletion } from "@dude/subagent-document-writer/lib/trim-autocomplete-completion";
import {
  gatewayRequest,
  gatewaySubagentId,
  gatewayWorkspaceId,
} from "./gateway-desktop";
import { buildGatewayConfig } from "./gateway-prompts";
import { readState } from "./local-chat-storage";
import { streamGatewayChatTurn } from "./gateway-chat";

const SUBAGENT_ID = "document-writer" as SubagentId;
const SCOPE_SUFFIX = ":writer-autocomplete";

export function writerAutocompleteScopeId(workspaceId: string): string {
  return `${workspaceId}${SCOPE_SUFFIX}`;
}

export function buildGatewayWriterAutocompleteConfig() {
  const base = buildGatewayConfig(SUBAGENT_ID);
  return {
    ...base,
    maxIterations: 2,
    systemPrompt: `${base.systemPrompt}${buildDocumentWriterAutocompleteAppendix()}`,
  };
}

async function ensureWriterAutocompleteInstance(realWorkspaceId: string) {
  const scope = writerAutocompleteScopeId(realWorkspaceId);
  const instanceId = gatewayWorkspaceId(SUBAGENT_ID, scope);
  const state = await readState();
  const row = state.workspaces[realWorkspaceId];
  const snapshot = row
    ? {
        id: row.id,
        subagentId: row.subagentId,
        name: row.name,
        status: row.status,
        configurations: row.configurations,
      }
    : undefined;

  await gatewayRequest("/instances", {
    method: "POST",
    timeoutMs: 120_000,
    body: {
      workspaceId: instanceId,
      subagentId: gatewaySubagentId(SUBAGENT_ID),
      config: buildGatewayWriterAutocompleteConfig(),
      ...(snapshot ? { workspaceSnapshot: snapshot } : {}),
    },
  });

  return instanceId;
}

export type WriterAutocompleteGatewayInput = {
  workspaceId: string;
  prefix: string;
  suffix?: string;
  title?: string;
  documentExcerpt?: string;
  signal?: AbortSignal;
};

/**
 * Run a short document-writer agent turn on a dedicated runner instance
 * (separate from the workspace chat agent).
 */
export async function requestWriterAutocompleteViaRunner(
  input: WriterAutocompleteGatewayInput,
): Promise<{ completion: string }> {
  const prefix = input.prefix.trim();
  if (prefix.length < 8) {
    return { completion: "" };
  }

  if (input.signal?.aborted) {
    return { completion: "" };
  }

  const instanceId = await ensureWriterAutocompleteInstance(input.workspaceId);
  if (input.signal?.aborted) {
    return { completion: "" };
  }

  const message = buildDocumentWriterAutocompleteUserMessage({
    prefix: input.prefix,
    suffix: input.suffix,
    title: input.title,
    documentExcerpt: input.documentExcerpt,
  });

  const data = await gatewayRequest<{
    sessionId: string;
    assistantMessageId?: string;
    messages: Array<{ id: string; role: string; status?: string }>;
  }>(`/instances/${encodeURIComponent(instanceId)}/chat`, {
    method: "POST",
    timeoutMs: 90_000,
    body: { message },
  });

  if (input.signal?.aborted) {
    return { completion: "" };
  }

  const assistantMessageId =
    data.assistantMessageId ??
    [...(data.messages ?? [])]
      .reverse()
      .find(
        (row) => row.role === "assistant" && row.status === "processing",
      )?.id;

  if (!assistantMessageId || !data.sessionId) {
    return { completion: "" };
  }

  const messages = await streamGatewayChatTurn(
    instanceId,
    data.sessionId,
    assistantMessageId,
    SUBAGENT_ID,
  );

  if (input.signal?.aborted) {
    return { completion: "" };
  }

  const assistant = messages.find((row) => row.id === assistantMessageId);
  const raw =
    typeof assistant?.content === "string"
      ? extractUserFacingMessage(assistant.content)
      : "";

  return {
    completion: trimAutocompleteCompletion(raw, prefix),
  };
}
