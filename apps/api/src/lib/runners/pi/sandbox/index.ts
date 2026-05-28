/**
 * Sandbox Extension — OS-level sandboxing for bash commands
 *
 * Vendored from `badlogic/pi-mono` (packages/coding-agent/examples/extensions/sandbox).
 * Wraps every bash invocation with `@anthropic-ai/sandbox-runtime`, which uses
 * `sandbox-exec` on macOS and `bubblewrap` on Linux to enforce filesystem and
 * network restrictions.
 *
 * Defaults below are tightened for the gateway: writes are limited to the
 * agent's workspace (cwd) and /tmp, credential paths are denied, and outbound
 * network is restricted to the providers we actually use.
 *
 * Per-workspace overrides can be placed at `<cwd>/.pi/sandbox.json`; global
 * overrides at `<agentDir>/extensions/sandbox.json`. Project config wins.
 *
 * If the runtime can't initialize (e.g. bwrap not installed, or kernel
 * userns disabled), the extension fails open: bash still runs, but
 * unsandboxed, and a warning is logged via the Pi UI.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SandboxManager, type SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";
import {
  type BashOperations,
  createBashTool,
  type ExtensionAPI,
  getAgentDir,
} from "@mariozechner/pi-coding-agent";

interface SandboxConfig extends SandboxRuntimeConfig {
  enabled?: boolean;
}

const DEFAULT_CONFIG: SandboxConfig = {
  enabled: true,
  network: {
    allowedDomains: [
      // Package registries (in case bash installs anything)
      "registry.npmjs.org",
      "registry.yarnpkg.com",
      "pypi.org",
      "*.pypi.org",
      "files.pythonhosted.org",
      // LLM providers actually used by the gateway
      "openrouter.ai",
      "*.openrouter.ai",
      "api.openai.com",
      "api.groq.com",
      "api.anthropic.com",
      // Source / firecrawl
      "github.com",
      "*.github.com",
      "raw.githubusercontent.com",
    ],
    deniedDomains: [],
  },
  filesystem: {
    // Per-process secrets / host credentials
    denyRead: [
      "~/.ssh",
      "~/.aws",
      "~/.gnupg",
      "/app/.pi-auth.json",
      "/etc/shadow",
    ],
    // Bash runs with cwd = the agent's workspace dir, so "." is the workspace.
    allowWrite: [".", "/tmp"],
    // Block dropping new credential files anywhere reachable.
    denyWrite: [
      ".env",
      ".env.*",
      "*.pem",
      "*.key",
      "/app/.pi-auth.json",
      "/app/src",
      "/app/python",
      "/app/node_modules",
    ],
  },
};

function loadConfig(cwd: string): SandboxConfig {
  const projectConfigPath = join(cwd, ".pi", "sandbox.json");
  const globalConfigPath = join(getAgentDir(), "extensions", "sandbox.json");

  let globalConfig: Partial<SandboxConfig> = {};
  let projectConfig: Partial<SandboxConfig> = {};

  if (existsSync(globalConfigPath)) {
    try {
      globalConfig = JSON.parse(readFileSync(globalConfigPath, "utf-8"));
    } catch (e) {
      console.error(`[sandbox] Could not parse ${globalConfigPath}: ${e}`);
    }
  }

  if (existsSync(projectConfigPath)) {
    try {
      projectConfig = JSON.parse(readFileSync(projectConfigPath, "utf-8"));
    } catch (e) {
      console.error(`[sandbox] Could not parse ${projectConfigPath}: ${e}`);
    }
  }

  return deepMerge(deepMerge(DEFAULT_CONFIG, globalConfig), projectConfig);
}

function deepMerge(base: SandboxConfig, overrides: Partial<SandboxConfig>): SandboxConfig {
  const result: SandboxConfig = { ...base };

  if (overrides.enabled !== undefined) result.enabled = overrides.enabled;
  if (overrides.network) {
    result.network = { ...base.network, ...overrides.network };
  }
  if (overrides.filesystem) {
    result.filesystem = { ...base.filesystem, ...overrides.filesystem };
  }

  const extOverrides = overrides as {
    ignoreViolations?: Record<string, string[]>;
    enableWeakerNestedSandbox?: boolean;
  };
  const extResult = result as {
    ignoreViolations?: Record<string, string[]>;
    enableWeakerNestedSandbox?: boolean;
  };

  if (extOverrides.ignoreViolations) {
    extResult.ignoreViolations = extOverrides.ignoreViolations;
  }
  if (extOverrides.enableWeakerNestedSandbox !== undefined) {
    extResult.enableWeakerNestedSandbox = extOverrides.enableWeakerNestedSandbox;
  }

  return result;
}

function createSandboxedBashOps(): BashOperations {
  return {
    async exec(command, cwd, { onData, signal, timeout }) {
      if (!existsSync(cwd)) {
        throw new Error(`Working directory does not exist: ${cwd}`);
      }

      const wrappedCommand = await SandboxManager.wrapWithSandbox(command);

      return new Promise((resolve, reject) => {
        const child = spawn("bash", ["-c", wrappedCommand], {
          cwd,
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
        });

        let timedOut = false;
        let timeoutHandle: NodeJS.Timeout | undefined;

        if (timeout !== undefined && timeout > 0) {
          timeoutHandle = setTimeout(() => {
            timedOut = true;
            if (child.pid) {
              try {
                process.kill(-child.pid, "SIGKILL");
              } catch {
                child.kill("SIGKILL");
              }
            }
          }, timeout * 1000);
        }

        child.stdout?.on("data", onData);
        child.stderr?.on("data", onData);

        child.on("error", (err) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          reject(err);
        });

        const onAbort = () => {
          if (child.pid) {
            try {
              process.kill(-child.pid, "SIGKILL");
            } catch {
              child.kill("SIGKILL");
            }
          }
        };

        signal?.addEventListener("abort", onAbort, { once: true });

        child.on("close", (code) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          signal?.removeEventListener("abort", onAbort);

          if (signal?.aborted) {
            reject(new Error("aborted"));
          } else if (timedOut) {
            reject(new Error(`timeout:${timeout}`));
          } else {
            resolve({ exitCode: code });
          }
        });
      });
    },
  };
}

export default function sandboxExtension(pi: ExtensionAPI) {
  pi.registerFlag("no-sandbox", {
    description: "Disable OS-level sandboxing for bash commands",
    type: "boolean",
    default: false,
  });

  const localCwd = process.cwd();
  const localBash = createBashTool(localCwd);

  let sandboxEnabled = false;
  let sandboxInitialized = false;

  pi.registerTool({
    ...localBash,
    label: "bash (sandboxed)",
    async execute(id, params, signal, onUpdate, _ctx) {
      if (!sandboxEnabled || !sandboxInitialized) {
        return localBash.execute(id, params, signal, onUpdate);
      }

      const sandboxedBash = createBashTool(localCwd, {
        operations: createSandboxedBashOps(),
      });
      return sandboxedBash.execute(id, params, signal, onUpdate);
    },
  });

  pi.on("user_bash", () => {
    if (!sandboxEnabled || !sandboxInitialized) return;
    return { operations: createSandboxedBashOps() };
  });

  pi.on("session_start", async (_event, ctx) => {
    const noSandbox = pi.getFlag("no-sandbox") as boolean;

    if (noSandbox) {
      sandboxEnabled = false;
      ctx.ui.notify("Sandbox disabled via --no-sandbox", "warning");
      return;
    }

    const cfg = loadConfig(ctx.cwd);

    if (!cfg.enabled) {
      sandboxEnabled = false;
      ctx.ui.notify("Sandbox disabled via config", "info");
      return;
    }

    const platform = process.platform;
    if (platform !== "darwin" && platform !== "linux") {
      sandboxEnabled = false;
      ctx.ui.notify(`Sandbox not supported on ${platform}`, "warning");
      return;
    }

    try {
      const cfgExt = cfg as unknown as {
        ignoreViolations?: Record<string, string[]>;
        enableWeakerNestedSandbox?: boolean;
      };

      await SandboxManager.initialize({
        network: cfg.network,
        filesystem: cfg.filesystem,
        ignoreViolations: cfgExt.ignoreViolations,
        enableWeakerNestedSandbox: cfgExt.enableWeakerNestedSandbox,
      });

      sandboxEnabled = true;
      sandboxInitialized = true;

      const networkCount = cfg.network?.allowedDomains?.length ?? 0;
      const writeCount = cfg.filesystem?.allowWrite?.length ?? 0;
      ctx.ui.setStatus(
        "sandbox",
        ctx.ui.theme.fg("accent", `🔒 Sandbox: ${networkCount} domains, ${writeCount} write paths`),
      );
      ctx.ui.notify("Sandbox initialized", "info");
    } catch (err) {
      sandboxEnabled = false;
      const message = err instanceof Error ? err.message : String(err);
      ctx.ui.notify(`Sandbox initialization failed (failing open): ${message}`, "error");
    }
  });

  pi.on("session_shutdown", async () => {
    if (sandboxInitialized) {
      try {
        await SandboxManager.reset();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  pi.registerCommand("sandbox", {
    description: "Show sandbox configuration",
    handler: async (_args, ctx) => {
      if (!sandboxEnabled) {
        ctx.ui.notify("Sandbox is disabled", "info");
        return;
      }

      const cfg = loadConfig(ctx.cwd);
      const lines = [
        "Sandbox Configuration:",
        "",
        "Network:",
        `  Allowed: ${cfg.network?.allowedDomains?.join(", ") || "(none)"}`,
        `  Denied: ${cfg.network?.deniedDomains?.join(", ") || "(none)"}`,
        "",
        "Filesystem:",
        `  Deny Read: ${cfg.filesystem?.denyRead?.join(", ") || "(none)"}`,
        `  Allow Write: ${cfg.filesystem?.allowWrite?.join(", ") || "(none)"}`,
        `  Deny Write: ${cfg.filesystem?.denyWrite?.join(", ") || "(none)"}`,
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}
