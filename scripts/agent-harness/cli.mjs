#!/usr/bin/env node
/**
 * Dude agent harness — lets Cursor agents (and humans) drive local Dude for testing.
 *
 * Usage:
 *   node scripts/agent-harness/cli.mjs status
 *   node scripts/agent-harness/cli.mjs url --specialist document-writer [--workspace <id>]
 *   node scripts/agent-harness/cli.mjs workspaces list --specialist document-writer
 *   node scripts/agent-harness/cli.mjs workspaces create --specialist document-writer --name "Agent test"
 *   node scripts/agent-harness/cli.mjs chat --specialist document-writer --message "Hello" [--workspace <id>]
 *   node scripts/agent-harness/cli.mjs probe document-writer [--workspace <id>]
 *   node scripts/agent-harness/cli.mjs browser-hints [--specialist document-writer] [--workspace <id>]
 */

import {
  API_URL,
  CLIENT_URL,
  SPECIALIST_IDS,
  clientUrlForPath,
  specialistWorkspacePath,
} from "./lib/env.mjs";
import {
  createWorkspace,
  listWorkspaces,
  probeHealth,
  runSpecialistChat,
} from "./lib/api.mjs";

function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      flags.json = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }
    positional.push(arg);
  }

  return { positional, flags };
}

function print(data, asJson) {
  if (asJson) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (typeof data === "string") {
    console.log(data);
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

function requireSpecialist(flags) {
  const specialist = flags.specialist?.trim();
  if (!specialist) {
    throw new Error(
      `--specialist is required (${SPECIALIST_IDS.join(", ")})`,
    );
  }
  if (!SPECIALIST_IDS.includes(specialist)) {
    throw new Error(
      `Unknown specialist "${specialist}". Use: ${SPECIALIST_IDS.join(", ")}`,
    );
  }
  return specialist;
}

async function probeClient() {
  try {
    const res = await fetch(`${CLIENT_URL}/`, {
      signal: AbortSignal.timeout(5000),
    });
    return { url: CLIENT_URL, ok: res.ok, status: res.status };
  } catch (error) {
    return {
      url: CLIENT_URL,
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function cmdStatus(flags) {
  const [client, apiChecks] = await Promise.all([
    probeClient(),
    probeHealth(),
  ]);

  const apiOk = apiChecks.some((c) => c.ok);
  const payload = {
    client,
    api: apiChecks,
    ready: client.ok && apiOk,
    hint: !client.ok || !apiOk ? "Run: npm run dev" : undefined,
  };

  print(payload, flags.json);
  if (!payload.ready) process.exit(1);
}

function cmdUrl(flags) {
  const specialist = flags.specialist?.trim();
  const workspaceId = flags.workspace?.trim();
  const path = specialist
    ? specialistWorkspacePath(specialist, workspaceId)
    : "/chat";
  const url = clientUrlForPath(path);
  print(
    {
      url,
      path,
      specialistId: specialist || null,
      workspaceId: workspaceId || null,
    },
    flags.json,
  );
}

async function cmdWorkspaces(sub, flags) {
  const specialist = requireSpecialist(flags);

  if (sub === "list") {
    const result = await listWorkspaces(specialist);
    print(result, flags.json);
    return;
  }

  if (sub === "create") {
    const name = flags.name?.trim() || `Agent test ${new Date().toISOString()}`;
    const result = await createWorkspace(specialist, name);
    const workspaceId = result?.workspace?.id;
    print(
      {
        ...result,
        openUrl: workspaceId
          ? clientUrlForPath(specialistWorkspacePath(specialist, workspaceId))
          : undefined,
      },
      flags.json,
    );
    return;
  }

  throw new Error(`Unknown workspaces subcommand: ${sub}`);
}

async function cmdChat(flags) {
  const specialist = requireSpecialist(flags);
  const message = flags.message?.trim();
  if (!message) {
    throw new Error("--message is required");
  }

  const workspaceId = flags.workspace?.trim();
  const timeoutMs = flags.timeout
    ? Number(flags.timeout) * 1000
    : undefined;

  print(
    {
      status: "running",
      specialistId: specialist,
      workspaceId: workspaceId || null,
      message,
    },
    false,
  );

  const result = await runSpecialistChat({
    specialistId: specialist,
    message,
    workspaceId,
    context: flags.context?.trim(),
    timeoutMs,
  });

  print(
    {
      ...result,
      openUrl: workspaceId
        ? clientUrlForPath(specialistWorkspacePath(specialist, workspaceId))
        : undefined,
    },
    flags.json,
  );
}

async function cmdProbe(name, flags) {
  if (name === "document-writer") {
    const { spawn } = await import("node:child_process");
    const { fileURLToPath } = await import("node:url");
    const script = fileURLToPath(
      new URL("../ui-harness/document-writer-probe.mjs", import.meta.url),
    );
    const args = [script];
    if (flags.workspace) {
      args.push(`--workspace-id=${flags.workspace}`);
    }
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, {
        stdio: "inherit",
        env: process.env,
      });
      child.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`probe exited with ${code}`));
      });
    });
    return;
  }

  throw new Error(
    `Unknown probe "${name}". Available: document-writer`,
  );
}

function cmdBrowserHints(flags) {
  const specialist = flags.specialist?.trim() || "document-writer";
  const workspaceId = flags.workspace?.trim();
  const path = specialistWorkspacePath(specialist, workspaceId);
  const url = clientUrlForPath(path);

  const hints = {
    workflow: [
      "1. npm run dev (client :5173 + API :8787)",
      "2. browser_navigate to openUrl",
      "3. browser_snapshot — interact with chat UI",
      "4. After agent turn, Runtime.evaluate probes below",
    ],
    openUrl: url,
    cdp: {
      agentSnapshot: "window.__DUDE_AGENT__?.snapshot()",
      documentWriter: "window.__DUDE_DW_DEBUG__?.snapshot()",
      navigate: 'window.__DUDE_AGENT__?.navigate("/chat/specialists/document-writer/<id>")',
    },
    selectors: {
      chatInput: 'textarea, [contenteditable="true"]',
      documentWriterCanvas: '[data-testid="dw-writer-canvas"]',
    },
    cli: {
      status: "npm run agent:status",
      createWorkspace:
        "npm run agent -- workspaces create --specialist document-writer --name \"Test\"",
      apiChat:
        "npm run agent -- chat --specialist document-writer --workspace <id> --message \"...\"",
    },
  };

  print(hints, flags.json);
}

function usage() {
  console.log(`Dude agent harness

Commands:
  status                         Client + API health
  url [--specialist] [--workspace]
  workspaces list|create         SQLite workspaces (localhost internal API)
  chat --specialist --message    Run specialist agent to completion (API)
  probe document-writer          Health + CDP snippets for Document Writer
  browser-hints                  MCP workflow cheat sheet

Env:
  DUDE_CLIENT_URL (default ${CLIENT_URL})
  DUDE_API_URL    (default ${API_URL})

Examples:
  npm run agent:status
  npm run agent -- workspaces create --specialist document-writer --name "Smoke"
  npm run agent -- chat --specialist document-writer --workspace <id> --message "Add a title"
  npm run agent -- browser-hints --specialist document-writer --workspace <id>
`);
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [command, sub, ...rest] = positional;

  if (!command || command === "help" || flags.help) {
    usage();
    process.exit(command ? 0 : 1);
  }

  try {
    switch (command) {
      case "status":
        await cmdStatus(flags);
        break;
      case "url":
        cmdUrl(flags);
        break;
      case "workspaces":
        await cmdWorkspaces(sub, flags);
        break;
      case "chat":
        await cmdChat(flags);
        break;
      case "probe":
        await cmdProbe(sub, flags);
        break;
      case "browser-hints":
        cmdBrowserHints(flags);
        break;
      default:
        console.error(`Unknown command: ${command}\n`);
        usage();
        process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (flags.json) {
      print({ error: message, status: error?.status }, true);
    } else {
      console.error(`Error: ${message}`);
    }
    process.exit(1);
  }

  void rest;
}

main();
