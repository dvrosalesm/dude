import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { killProcessOnPort } from "./agent-port-utils.js";

const MARKER_FILE = ".dude-gateway.json";
const SPAWN_FILE = ".dude-agent-spawn.json";

export interface GatewayMarker {
  port: number;
  pid: number;
  runner: string;
  startedAt: string;
}

export function writeGatewayMarker(
  workDir: string,
  marker: GatewayMarker,
): void {
  writeFileSync(join(workDir, MARKER_FILE), JSON.stringify(marker), "utf8");
}

export function readGatewayMarker(workDir: string): GatewayMarker | null {
  try {
    const parsed = JSON.parse(
      readFileSync(join(workDir, MARKER_FILE), "utf8"),
    ) as GatewayMarker;
    if (!parsed?.port || !parsed?.pid) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readSpawnFilePort(workDir: string): number | null {
  try {
    const parsed = JSON.parse(
      readFileSync(join(workDir, SPAWN_FILE), "utf8"),
    ) as { env?: { GATEWAY_PORT?: string } };
    const port = parseInt(String(parsed?.env?.GATEWAY_PORT ?? ""), 10);
    return Number.isFinite(port) ? port : null;
  } catch {
    return null;
  }
}

function killPid(pid: number): void {
  try {
    process.kill(pid, "SIGKILL");
    console.log(`[Gateway] Killed stale agent pid ${pid}`);
  } catch {
    // already gone
  }
}

/** Stop orphaned gateways/tmux agents tied to a workspace work dir. */
export async function killStaleWorkspaceAgent(
  workDir: string,
  sessionName: string,
  nextPort: number,
  killTmuxSession: (name: string) => void,
): Promise<void> {
  const marker = readGatewayMarker(workDir);
  if (marker?.pid) killPid(marker.pid);
  if (marker?.port) await killProcessOnPort(marker.port);

  const spawnPort = readSpawnFilePort(workDir);
  if (spawnPort && spawnPort !== nextPort) {
    await killProcessOnPort(spawnPort);
  }

  await killProcessOnPort(nextPort);
  killTmuxSession(sessionName);

  try {
    unlinkSync(join(workDir, MARKER_FILE));
  } catch {
    // ignore
  }
}
