#!/usr/bin/env node
/**
 * Presentation Editor UI probe — server health + CDP snippets for browser MCP.
 *
 * Usage:
 *   node scripts/ui-harness/presentation-editor-probe.mjs
 *   node scripts/ui-harness/presentation-editor-probe.mjs --workspace-id ws-presentation-editor-abc
 */

const CLIENT_URL = process.env.DUDE_CLIENT_URL || "http://127.0.0.1:5173";
const API_URL = process.env.DUDE_API_URL || "http://127.0.0.1:8787";

const workspaceArg = process.argv.find((a) => a.startsWith("--workspace-id="));
const workspaceId = workspaceArg?.split("=")[1]?.trim();

async function probeUrl(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { url, ok: res.ok, status: res.status };
  } catch (err) {
    return {
      url,
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function printCdpSnippets() {
  const basePath = workspaceId
    ? `/chat/subagents/presentation-editor/${workspaceId}`
    : "/chat/subagents/presentation-editor";

  console.log("\n--- Browser MCP ---\n");
  console.log(`Navigate: ${CLIENT_URL}${basePath}`);
  console.log("\nAfter AI finishes or hydration, evaluate:\n");
  console.log("window.__DUDE_PE_DEBUG__?.snapshot()");
  console.log("\nFull probe object:\n");
  console.log(
    JSON.stringify(
      {
        evaluate: "window.__DUDE_PE_DEBUG__?.snapshot()",
        expect: {
          slideCount: ">= 1 after edit_presentation or insertSlide",
        },
        selectors: {
          chatInput: 'textarea[placeholder*="Describe the changes"]',
          addSlide: 'button:has-text("Add slide")',
          present: 'button:has-text("Present")',
        },
      },
      null,
      2,
    ),
  );
}

async function main() {
  console.log("Presentation Editor UI probe\n");

  const [client, api] = await Promise.all([
    probeUrl(`${CLIENT_URL}/`),
    probeUrl(`${API_URL}/v1/health`).catch(() =>
      probeUrl(`${API_URL}/healthz`),
    ),
  ]);

  console.log("Client:", client.ok ? `OK (${client.status})` : `DOWN — ${client.error || client.status}`);
  console.log("API:   ", api.ok ? `OK (${api.status})` : `DOWN — ${api.error || api.status}`);

  if (!client.ok) {
    console.error("\nStart dev: npm run dev");
    process.exit(1);
  }

  printCdpSnippets();

  if (!api.ok) {
    console.warn("\nAPI not reachable — chat/agent turns may fail until API is up.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
