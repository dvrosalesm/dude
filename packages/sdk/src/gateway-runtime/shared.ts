import { config } from "./config.js";
import type { ToolDefinition } from "../types.js";

export type ToolResult = Awaited<ReturnType<ToolDefinition["execute"]>>;

export function toolText(
  data: unknown,
  details: Record<string, unknown> = {},
): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
    details,
  };
}

export function toolError(
  error: string,
  details: Record<string, unknown> = {},
): ToolResult {
  return toolText({ error }, details);
}

export function wsPath(...segments: string[]): string {
  const base = `/workspace/${config.workspaceId}`;
  return segments.length ? `${base}/${segments.join("/")}` : base;
}

export function isApiError(
  r: Record<string, unknown> | null | undefined,
): r is { error: string } {
  return !!r && typeof (r as { error?: unknown }).error === "string";
}

export function getOrgUser(): { orgId: string; userId: string | undefined } {
  const orgId = config.organizationId || config.workspaceId;
  const parts = config.workspaceId.split(":");
  const userId = parts.length >= 2 ? parts[parts.length - 1] : undefined;
  return { orgId, userId };
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
}

export interface OpenRouterOptions {
  model: string;
  messages: OpenRouterMessage[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export async function openRouterChat(opts: OpenRouterOptions): Promise<string> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error(
      "No API key configured for OpenRouter. Specialist tools like generate_slide need an " +
        "OpenRouter key in Settings → API & Models (or OPEN_ROUTER_API_KEY in .env.local). " +
        "This is separate from Codex CLI login.",
    );
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 1000,
      temperature: opts.temperature ?? 0.7,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return (data?.choices?.[0]?.message?.content || "").trim();
}
