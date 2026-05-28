import { Type } from "@sinclair/typebox";
import { config } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "../types.js";
import { toolText } from "./_shared.js";

async function webScrape(url: string): Promise<Record<string, unknown>> {
  if (!config.firecrawlUrl || !config.firecrawlKey) {
    return { error: "Web scrape not configured" };
  }
  try {
    const res = await fetch(`${config.firecrawlUrl}/v1/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.firecrawlKey}`,
      },
      body: JSON.stringify({ url, formats: ["markdown"] }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { error: `Scrape failed (${res.status})` };
    const data = await res.json();
    const page = data.data || {};
    return {
      title: page.metadata?.title || "",
      url: page.metadata?.sourceURL || url,
      content: (page.markdown || "").slice(0, 4000),
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export function createWebScrapeTool(): ToolDefinition {
  return {
    name: "web_scrape",
    label: "Web Scrape",
    description:
      "Scrape a specific web page and extract its content as markdown. " +
      "Use this to read full articles, documentation, or data tables " +
      "from a URL found via web_search.",
    parameters: Type.Object({
      url: Type.String({ description: "URL to scrape" }),
    }),
    execute: async (_toolCallId, params) => {
      return toolText(await webScrape(params.url));
    },
  };
}
