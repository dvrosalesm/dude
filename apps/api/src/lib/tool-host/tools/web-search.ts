import { Type } from "@sinclair/typebox";
import { config } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "../types.js";
import { toolText } from "./_shared.js";

// ---------------------------------------------------------------------------
// Firecrawl search
// ---------------------------------------------------------------------------

async function firecrawlSearch(query: string): Promise<Record<string, unknown> | null> {
  if (!config.firecrawlUrl || !config.firecrawlKey) return null;
  try {
    console.log(`[web_search] Trying Firecrawl: "${query}"`);
    const res = await fetch(`${config.firecrawlUrl}/v1/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.firecrawlKey}`,
      },
      body: JSON.stringify({ query, limit: 5 }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[web_search] Firecrawl failed (${res.status}): ${text.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    const results = (data.data || []).map((r: any) => ({
      title: r.title || "",
      url: r.url || "",
      content: (r.markdown || r.content || "").slice(0, 800),
    }));
    console.log(`[web_search] Firecrawl returned ${results.length} results`);
    return { results };
  } catch (err: unknown) {
    console.error(`[web_search] Firecrawl error:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ---------------------------------------------------------------------------
// DuckDuckGo fallback
// ---------------------------------------------------------------------------

async function ddgSearch(query: string): Promise<Record<string, unknown>> {
  try {
    console.log(`[web_search] Falling back to DuckDuckGo: "${query}"`);
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AgentsGT/1.0)",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error(`[web_search] DDG failed (${res.status})`);
      return { error: `DuckDuckGo search failed (${res.status})` };
    }
    const html = await res.text();
    const results = parseDdgHtml(html);
    console.log(`[web_search] DDG returned ${results.length} results`);
    if (results.length === 0) {
      return { results: [], note: "No results found" };
    }
    return { results };
  } catch (err: unknown) {
    console.error(`[web_search] DDG error:`, err instanceof Error ? err.message : String(err));
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function parseDdgHtml(html: string): Array<{ title: string; url: string; content: string }> {
  const results: Array<{ title: string; url: string; content: string }> = [];
  // Match result blocks: <a rel="nofollow" class="result__a" href="...">title</a>
  // and <a class="result__snippet" ...>snippet</a>
  const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  const links: Array<{ url: string; title: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const rawUrl = match[1];
    const title = stripHtml(match[2]).trim();
    // DDG wraps URLs in a redirect — extract the actual URL
    const actualUrl = extractDdgUrl(rawUrl);
    if (title && actualUrl) {
      links.push({ url: actualUrl, title });
    }
  }

  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(stripHtml(match[1]).trim());
  }

  for (let i = 0; i < Math.min(links.length, 5); i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      content: (snippets[i] || "").slice(0, 800),
    });
  }

  return results;
}

function extractDdgUrl(raw: string): string {
  // DDG links look like: //duckduckgo.com/l/?uddg=https%3A%2F%2F...&rut=...
  try {
    if (raw.includes("uddg=")) {
      const params = new URLSearchParams(raw.split("?")[1]);
      return decodeURIComponent(params.get("uddg") || raw);
    }
    if (raw.startsWith("http")) return raw;
    if (raw.startsWith("//")) return `https:${raw}`;
    return raw;
  } catch {
    return raw;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Main search — Firecrawl first, DDG fallback
// ---------------------------------------------------------------------------

async function webSearch(query: string): Promise<Record<string, unknown>> {
  const firecrawlResult = await firecrawlSearch(query);
  if (firecrawlResult) return firecrawlResult;
  return ddgSearch(query);
}

export function createWebSearchTool(): ToolDefinition {
  return {
    name: "web_search",
    label: "Web Search",
    description:
      "Search the internet using a search engine. Use this to find current information, " +
      "industry benchmarks, market data, competitor websites, trends, and news. " +
      "Requires a 'query' parameter. Returns up to 5 results with title, URL, and content snippet.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
    }),
    execute: async (_toolCallId, params) => {
      return toolText(await webSearch(params.query));
    },
  };
}
