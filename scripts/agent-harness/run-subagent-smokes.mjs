#!/usr/bin/env node
/**
 * Smoke-test all subagents via subagent-run (uses configured runner from API).
 */
import { getRuntimeSettings, runSubagentChat } from "./lib/api.mjs";

const TESTS = [
  {
    subagentId: "main-assistant",
    workspaceId: undefined,
    message:
      "List the delegable subagents you can hand work to. Reply in 2-3 sentences.",
    timeoutSec: 120,
  },
  {
    subagentId: "data-analyst",
    workspaceId: "178ceef7-1b80-4a22-9a6e-0b4b971a1067",
    message:
      "Run this SQL and report the result: SELECT 1 AS ok, 'harness' AS label;",
    timeoutSec: 120,
  },
  {
    subagentId: "document-writer",
    workspaceId: "9257709f-334d-47d2-a2b7-aa335cd8ae6f",
    message:
      "Set the document title to 'Harness test' and add one short paragraph about API smoke testing. Use edit_document.",
    timeoutSec: 180,
  },
  {
    subagentId: "design-branding",
    workspaceId: "9286fc98-d39a-40eb-96f2-0420f5d6b01e",
    message:
      "Create a minimal brand palette via workspace_save: name 'Harness', primary #1a1a2e, accent #e94560. Confirm what you saved.",
    timeoutSec: 180,
  },
  {
    subagentId: "presentation-editor",
    workspaceId: "ws-presentation-editor-ee1cfba6-49e0-4ab6-bcc7-bd35d0c5b6bf",
    message: "How many slides are in this deck? Reply with the count only.",
    timeoutSec: 90,
  },
];

async function fetchInstances() {
  const res = await fetch("http://127.0.0.1:8787/v1/instances", {
    signal: AbortSignal.timeout(10_000),
  });
  return res.json();
}

async function main() {
  const runtime = await getRuntimeSettings().catch(() => null);
  const results = [];

  for (const test of TESTS) {
    const started = Date.now();
    let result;
    let error;
    try {
      result = await runSubagentChat({
        subagentId: test.subagentId,
        message: test.message,
        workspaceId: test.workspaceId,
        timeoutMs: test.timeoutSec * 1000,
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    const elapsedMs = Date.now() - started;
    const answer = String(result?.answer || result?.question || "").trim();
    const pass = !error && answer.length > 20;

    results.push({
      subagentId: test.subagentId,
      workspaceId: test.workspaceId ?? null,
      pass,
      elapsedMs,
      answerLen: answer.length,
      answerPreview: answer.slice(0, 160),
      type: result?.type,
      error: error ?? null,
    });

    console.log(
      `${pass ? "PASS" : "FAIL"} ${test.subagentId} (${(elapsedMs / 1000).toFixed(1)}s)`,
    );
    if (!pass) {
      console.log(`  ${error || answer.slice(0, 120) || "(empty)"}`);
    }
  }

  const instances = await fetchInstances().catch(() => []);
  const runners = Object.fromEntries(
    instances.map((i) => [i.subagentId + ":" + i.id.slice(0, 40), i.runner]),
  );

  const summary = {
    configuredRunner: runtime?.agentRunner ?? null,
    hasCursorApiKey: runtime?.hasCursorApiKey ?? false,
    results,
    instanceRunners: runners,
    passed: results.filter((r) => r.pass).length,
    total: results.length,
  };

  console.log("\n" + JSON.stringify(summary, null, 2));
  process.exit(summary.passed === summary.total ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
