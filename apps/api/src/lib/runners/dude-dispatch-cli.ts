#!/usr/bin/env npx tsx
/**
 * Typed dispatch CLI — the only supported way for native runners (Codex) to call subagent actions.
 *
 * Usage:
 *   dude-dispatch-cli.ts --manifest /path/.dude-runner-session.json <action> '<payload-json>'
 *
 * Never curl. Never guess ports or DB paths.
 */

import {
  dispatchViaManifest,
  readRunnerSessionManifest,
} from "../runner-session-manifest.js";
import { fetchAgentCatalog } from "./tool-host-client.js";

function parseArgs(argv: string[]): {
  manifestPath: string;
  action: string;
  payloadJson: string;
} {
  let manifestPath = process.env.DUDE_SESSION_MANIFEST_PATH?.trim() || "";
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--manifest" && argv[i + 1]) {
      manifestPath = argv[i + 1];
      i += 1;
      continue;
    }
    positional.push(arg);
  }

  if (!manifestPath) {
    throw new Error(
      "Missing manifest path. Pass --manifest /path/.dude-runner-session.json or set DUDE_SESSION_MANIFEST_PATH.",
    );
  }

  const action = positional[0]?.trim();
  if (!action) {
    throw new Error("Usage: dude-dispatch-cli.ts --manifest <path> <action> '<payload-json>'");
  }

  const payloadJson = positional[1]?.trim() || "{}";
  return { manifestPath, action, payloadJson };
}

async function main() {
  const { manifestPath, action, payloadJson } = parseArgs(process.argv.slice(2));
  const manifest = readRunnerSessionManifest(manifestPath);

  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(payloadJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      payload = parsed as Record<string, unknown>;
    }
  } catch {
    throw new Error(`Invalid payload JSON: ${payloadJson.slice(0, 200)}`);
  }

  if (action === "__catalog__") {
    const catalog = await fetchAgentCatalog({
      baseUrl: manifest.internalApi.baseUrl,
      workspaceId: manifest.workspaceId,
      subagentId: manifest.subagentId,
      organizationId: manifest.organizationId,
      runner: manifest.runner,
    });
    process.stdout.write(`${JSON.stringify(catalog)}\n`);
    return;
  }

  const result = await dispatchViaManifest(manifest, {
    action,
    payload,
    callId: `cli-${Date.now()}`,
  });

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
