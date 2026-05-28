import { execSync } from "node:child_process";

/** Kill any process listening on a TCP port (best-effort). */
export async function killProcessOnPort(port: number): Promise<void> {
  if (!Number.isFinite(port) || port <= 0) return;

  try {
    const output = execSync(
      `lsof -ti:${port} 2>/dev/null || fuser ${port}/tcp 2>/dev/null || true`,
      { encoding: "utf-8", timeout: 5_000 },
    ).trim();

    if (!output) return;

    for (const pid of output.split(/\s+/).filter(Boolean)) {
      try {
        process.kill(Number(pid), "SIGKILL");
        console.log(`[Gateway] Killed stale process ${pid} on port ${port}`);
      } catch {
        // already gone
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  } catch {
    // lsof/fuser unavailable
  }
}
