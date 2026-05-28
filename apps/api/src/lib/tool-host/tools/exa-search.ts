import { Type } from "@sinclair/typebox";
import { config } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "../types.js";
import { toolText } from "./_shared.js";

const EXA_URL = "https://api.exa.ai/search";
const EXA_CREDITS_PER_CALL = 50;

/**
 * Fire-and-forget per-call billing. Posts to the gateway's internal
 * /charge-tool endpoint which deducts from the org's active subscription.
 * Never throws — billing failure must not break a successful tool result.
 */
function chargeExaCredits(): void {
  if (!config.workspaceId || config.workspaceId.includes(":")) return;
  const url = `http://127.0.0.1:${config.gatewayInternalPort}/v1/internal/workspace/${config.workspaceId}/charge-tool`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool: "exa_search",
      credits: EXA_CREDITS_PER_CALL,
      organizationId: config.organizationId || undefined,
    }),
    signal: AbortSignal.timeout(5_000),
  }).catch((err) => {
    console.warn(
      "[exa_search] charge failed:",
      err instanceof Error ? err.message : String(err),
    );
  });
}

async function exaSearch(params: {
  query: string;
  category?: string;
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
}): Promise<Record<string, unknown>> {
  if (!config.exaApiKey) {
    return { error: "Exa not configured (EXA_API_KEY missing)" };
  }

  const numResults = Math.min(Math.max(params.numResults ?? 10, 1), 25);

  try {
    console.log(
      `[exa_search] "${params.query}"${params.category ? ` (${params.category})` : ""} numResults=${numResults}`,
    );
    const body: Record<string, unknown> = {
      query: params.query,
      numResults,
      type: "auto",
      contents: { text: { maxCharacters: 1000 } },
    };
    if (params.category) body.category = params.category;
    if (params.includeDomains?.length) body.includeDomains = params.includeDomains;
    if (params.excludeDomains?.length) body.excludeDomains = params.excludeDomains;
    if (params.startPublishedDate) body.startPublishedDate = params.startPublishedDate;

    const res = await fetch(EXA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.exaApiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[exa_search] failed (${res.status}): ${text.slice(0, 200)}`);
      return { error: `Exa request failed (${res.status}): ${text.slice(0, 300)}` };
    }
    const data = await res.json();
    const results = (data.results || []).map((r: any) => ({
      title: r.title || "",
      url: r.url || "",
      author: r.author || "",
      publishedDate: r.publishedDate || "",
      score: typeof r.score === "number" ? r.score : null,
      content: typeof r.text === "string" ? r.text.slice(0, 1000) : "",
    }));
    console.log(`[exa_search] returned ${results.length} results`);
    chargeExaCredits();
    return { results };
  } catch (err: unknown) {
    console.error(
      `[exa_search] error:`,
      err instanceof Error ? err.message : String(err),
    );
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export function createExaSearchTool(): ToolDefinition {
  return {
    name: "exa_search",
    label: "Exa Search",
    description:
      "Neural web search via Exa — semantic ranking that beats keyword search for entity discovery. " +
      "Use this (not web_search) to find companies, people, LinkedIn profiles, news, or research articles. " +
      "Set `category` to narrow results: 'company' for company sites, 'linkedin profile' for people, " +
      "'news' for news articles, 'github' for repos, 'tweet' for X posts, 'pdf' for documents, " +
      "'financial report' for filings, 'research paper' for academic work, 'personal site' for blogs. " +
      "Returns up to 25 results with title, url, author, publishedDate, score, and a 1000-char content snippet. " +
      `Costs ${EXA_CREDITS_PER_CALL} credits per call — be deliberate, batch in parallel rather than retrying with tweaked queries.`,
    parameters: Type.Object({
      query: Type.String({
        description:
          "Natural-language query. Semantic search works best with descriptive phrasing, " +
          "e.g. 'Series B fintech startups in Brazil hiring engineering leadership'.",
      }),
      category: Type.Optional(
        Type.String({
          description:
            "Narrow to a category. Allowed: company, linkedin profile, news, github, tweet, pdf, financial report, research paper, personal site.",
        }),
      ),
      numResults: Type.Optional(
        Type.Integer({
          minimum: 1,
          maximum: 25,
          default: 10,
          description: "How many results to return (1-25). Default 10.",
        }),
      ),
      includeDomains: Type.Optional(
        Type.Array(Type.String(), {
          description: "Restrict to these domains, e.g. ['linkedin.com'].",
        }),
      ),
      excludeDomains: Type.Optional(
        Type.Array(Type.String(), {
          description: "Exclude these domains.",
        }),
      ),
      startPublishedDate: Type.Optional(
        Type.String({
          description:
            "Only return content published after this ISO date (YYYY-MM-DD). Useful for recent news.",
        }),
      ),
    }),
    execute: async (_toolCallId, params) => {
      return toolText(await exaSearch(params));
    },
  };
}
