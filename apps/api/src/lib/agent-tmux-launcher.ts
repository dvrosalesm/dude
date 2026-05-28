/**
 * Spawn target for tmux agent sessions. Reads `.dude-agent-spawn.json` from cwd
 * and execs the runner with inherited stdio (visible in the tmux pane).
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface AgentSpawnFile {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

function loadSpawnFile(cwd: string): AgentSpawnFile {
  const raw = readFileSync(join(cwd, ".dude-agent-spawn.json"), "utf8");
  const parsed = JSON.parse(raw) as AgentSpawnFile;
  if (!parsed.command || !Array.isArray(parsed.args) || !parsed.cwd) {
    throw new Error("Invalid .dude-agent-spawn.json");
  }
  return parsed;
}

const config = loadSpawnFile(process.cwd());
console.log(
  `[agent-tmux-launcher] starting ${config.command} on port ${config.env.GATEWAY_PORT ?? "?"}`,
);

const child = spawn(config.command, config.args, {
  cwd: config.cwd,
  env: { ...process.env, ...config.env },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error("[agent-tmux-launcher] failed to start agent:", error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[agent-tmux-launcher] agent exited via signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
