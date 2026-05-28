import { Type } from "@sinclair/typebox";
import { config } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "../types.js";
import { toolText } from "./_shared.js";

async function searchInWebsite(
  url: string,
  prompt: string,
  schema?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!config.firecrawlUrl || !config.firecrawlKey) {
    return { error: "Firecrawl not configured" };
  }
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const body: Record<string, unknown> = {
        url,
        formats: ["json"],
        jsonOptions: { prompt, ...(schema ? { schema } : {}) },
      };
      const res = await fetch(`${config.firecrawlUrl}/v1/scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.firecrawlKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        const msg = `Scrape failed (${res.status})`;
        if (attempt < maxRetries) continue;
        return { error: msg };
      }
      const data = await res.json();
      const page = data.data || {};
      return {
        url: page.metadata?.sourceURL || url,
        json: page.json ?? page.llm_extraction ?? null,
      };
    } catch (err: unknown) {
      if (attempt < maxRetries) continue;
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return { error: "Max retries exceeded" };
}

export function createSearchInWebsiteTool(): ToolDefinition {
  return {
    name: "search_in_website",
    label: "Search in Website",
    description:
      "Scrape a URL and extract structured JSON data using a natural-language prompt. " +
      "Optionally provide a JSON Schema to enforce the output shape. " +
      "Retries up to 5 times on transient failures.",
    parameters: Type.Object({
      url: Type.String({ description: "URL to scrape" }),
      prompt: Type.String({
        description:
          "Natural-language instruction for what to extract (e.g. 'Extract the page title and all links')",
      }),
      schema: Type.Optional(
        Type.Record(Type.String(), Type.Unknown(), {
          description:
            "Optional JSON Schema describing the desired output shape",
        }),
      ),
    }),
    execute: async (_toolCallId, params) => {
      return toolText(
        await searchInWebsite(params.url, params.prompt, params.schema),
      );
    },
  };
}
