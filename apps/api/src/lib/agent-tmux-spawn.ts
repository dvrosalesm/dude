/**
 * Optional tmux-backed agent spawning so gateway output is visible via
 * `tmux attach -t <session>`. Falls back to in-process spawn when tmux
 * is missing or disabled.
 */

import { createHash } from "node:crypto";
import { execSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RunnerSpawnPlan } from "./runners/index.js";

const TMUX_SESSION_PREFIX = "dude-agent";

let tmuxAvailability: boolean | null = null;

/** POSIX single-quote escaping for shell fragments. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildTmuxSessionName(workspaceId: string): string {
  const hash = createHash("sha256").update(workspaceId).digest("hex").slice(0, 8);
  const slug = workspaceId
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  return `${TMUX_SESSION_PREFIX}-${slug || "agent"}-${hash}`.slice(0, 64);
}

export function buildAgentSpawnFile(spawnPlan: RunnerSpawnPlan): string {
  return JSON.stringify(
    {
      command: spawnPlan.command,
      args: spawnPlan.args,
      cwd: spawnPlan.cwd,
      env: spawnPlan.env,
    },
    null,
    2,
  );
}

export function isTmuxAvailable(): boolean {
  if (tmuxAvailability !== null) return tmuxAvailability;
  try {
    execSync("command -v tmux", { stdio: "ignore", timeout: 5_000 });
    tmuxAvailability = true;
  } catch {
    tmuxAvailability = false;
  }
  return tmuxAvailability;
}

/** True when tmux should wrap agent spawns (default: auto when installed). */
export function shouldSpawnAgentInTmux(): boolean {
  const flag = process.env.DUDE_AGENT_TMUX?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  return isTmuxAvailable();
}

export function tmuxAttachCommand(sessionName: string): string {
  return `tmux attach -t ${shellQuote(sessionName)}`;
}

export function isTmuxSessionAlive(sessionName: string): boolean {
  const result = spawnSync("tmux", ["has-session", "-t", sessionName], {
    stdio: "ignore",
    timeout: 5_000,
  });
  return result.status === 0;
}

export function captureTmuxPane(sessionName: string, lines = 80): string {
  const result = spawnSync(
    "tmux",
    ["capture-pane", "-p", "-t", sessionName, "-S", `-${lines}`],
    { encoding: "utf8", timeout: 5_000 },
  );
  if (result.status !== 0) {
    return result.stderr?.toString().trim() || "";
  }
  return result.stdout?.toString().trim() || "";
}

export function killTmuxSession(sessionName: string): void {
  spawnSync("tmux", ["kill-session", "-t", sessionName], {
    stdio: "ignore",
    timeout: 5_000,
  });
}

export interface TmuxAgentSpawnResult {
  sessionName: string;
  spawnFilePath: string;
  launcherPath: string;
}

export interface TmuxAgentSpawnOptions {
  launcherPath: string;
  tsxEntry?: string;
}

export interface SpawnAgentInTmuxOptions {
  skipSessionKill?: boolean;
}

export function spawnAgentInTmux(
  workspaceId: string,
  spawnPlan: RunnerSpawnPlan,
  workDir: string,
  options: TmuxAgentSpawnOptions,
  spawnOptions: SpawnAgentInTmuxOptions = {},
): TmuxAgentSpawnResult {
  const sessionName = buildTmuxSessionName(workspaceId);
  if (!spawnOptions.skipSessionKill) {
    killTmuxSession(sessionName);
  }

  const spawnFilePath = join(workDir, ".dude-agent-spawn.json");
  writeFileSync(spawnFilePath, buildAgentSpawnFile(spawnPlan), "utf8");

  const launcherPath = options.launcherPath.trim();
  if (!launcherPath) {
    throw new Error("tmux launcher path is required");
  }

  const tsxEntry = options.tsxEntry?.trim();
  const tmuxCommand = tsxEntry
    ? [tsxEntry, launcherPath]
    : ["npx", "tsx", launcherPath];

  const result = spawnSync(
    "tmux",
    ["new-session", "-d", "-s", sessionName, "-c", workDir, ...tmuxCommand],
    { stdio: "pipe", timeout: 10_000, env: process.env },
  );

  if (result.status !== 0) {
    const detail = result.stderr?.toString().trim() || "unknown tmux error";
    throw new Error(`Failed to start tmux session ${sessionName}: ${detail}`);
  }

  return { sessionName, spawnFilePath, launcherPath };
}
