/**
 * Minimal JSON-RPC client for `codex app-server` (stdio transport).
 * Uses the user's existing Codex CLI login (~/.codex) — no API_KEY required.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";
import { waitForUiInputRemote } from "../ui-input-client.js";
import { isDudeUiModeEnabled } from "../ui-input-mode.js";
import type { UiInputResponse } from "../ui-input-types.js";
import { logCodexLine, logCodexRpc, shouldLogCodexRun } from "./codex-run-logger.js";
import {
  buildCodexDynamicToolsForThread,
  executeCodexDynamicToolCall,
} from "./codex-dynamic-tools.js";

type JsonRecord = Record<string, unknown>;

export type CodexSandboxPolicy = Record<string, unknown>;

/**
 * Codex `workspace-write` blocks network by default. Dynamic specialist tools
 * dispatch in-process (no shell/curl), but network may still be needed for
 * web search and other Codex capabilities — default to workspace write + network.
 *
 * Override with CODEX_SANDBOX:
 * - `workspace-write` — filesystem write, no network (legacy)
 * - `danger-full-access` — no sandbox restrictions
 * - `read-only` — read-only sandbox
 */
export function resolveCodexSandboxPolicy(cwd?: string): CodexSandboxPolicy {
  const mode = (process.env.CODEX_SANDBOX || "workspace-write-network").trim();
  const normalized = mode.toLowerCase().replace(/_/g, "-");

  if (normalized === "danger-full-access" || normalized === "dangerfullaccess") {
    return { type: "dangerFullAccess" };
  }

  if (normalized === "read-only" || normalized === "readonly") {
    return { type: "readOnly" };
  }

  if (normalized === "external-sandbox" || normalized === "externalsandbox") {
    const network =
      process.env.CODEX_NETWORK_ACCESS?.trim().toLowerCase() === "false"
        ? "restricted"
        : "enabled";
    return { type: "externalSandbox", networkAccess: network };
  }

  let networkAccess = true;
  if (normalized === "workspace-write") {
    networkAccess =
      process.env.CODEX_NETWORK_ACCESS?.trim().toLowerCase() === "true";
  } else if (process.env.CODEX_NETWORK_ACCESS?.trim().toLowerCase() === "false") {
    networkAccess = false;
  }

  const policy: CodexSandboxPolicy = {
    type: "workspaceWrite",
    networkAccess,
  };

  const root = cwd?.trim();
  if (root) {
    policy.writableRoots = [root];
  }

  return policy;
}

export type CodexAppServerEventHandler = (
  method: string,
  params: unknown,
) => void;

export type CodexDynamicToolTracer = {
  onStart: (tool: string, args: Record<string, unknown>) => void;
  onEnd: (tool: string, args: Record<string, unknown>, result: string) => void;
};

let activeDynamicToolTracer: CodexDynamicToolTracer | null = null;

export function setActiveCodexDynamicToolTracer(
  tracer: CodexDynamicToolTracer | null,
): void {
  activeDynamicToolTracer = tracer;
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export interface CodexAppServerOptions {
  codexBin?: string;
  cwd?: string;
  onEvent?: CodexAppServerEventHandler;
}

export class CodexAppServer {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private rl: readline.Interface | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private readyPromise: Promise<void> | null = null;
  private initialized = false;
  private readonly codexBin: string;
  private readonly cwd: string;
  private onEvent?: CodexAppServerEventHandler;
  private readonly turnWaiters = new Map<
    string,
    Array<(result: { status: string; error?: string }) => void>
  >();

  constructor(options: CodexAppServerOptions = {}) {
    this.codexBin = options.codexBin?.trim() || process.env.CODEX_BIN?.trim() || "codex";
    this.cwd = options.cwd?.trim() || process.cwd();
    this.onEvent = options.onEvent;
  }

  setOnEvent(handler: CodexAppServerEventHandler | undefined) {
    this.onEvent = handler;
  }

  async ensureReady(): Promise<void> {
    if (this.initialized) return;
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = this.start();
    await this.readyPromise;
  }

  async request(method: string, params?: unknown): Promise<unknown> {
    await this.ensureReady();
    if (shouldLogCodexRun()) {
      const detail =
        method === "turn/start" && params && typeof params === "object"
          ? truncateForLog(String(asRecord(params).threadId || ""))
          : undefined;
      logCodexRpc(method, detail);
    }
    return this.sendRequest(method, params);
  }

  notify(method: string, params?: unknown) {
    this.write({ method, params: params ?? {} });
  }

  async startThread(params: Record<string, unknown> = {}): Promise<string> {
    const sandboxPolicy = resolveCodexSandboxPolicy(this.cwd);
    let dynamicTools: Record<string, unknown>[] = [];
    dynamicTools = await buildCodexDynamicToolsForThread();
    if (shouldLogCodexRun() && dynamicTools.length > 0) {
      logCodexLine(
        `registering ${dynamicTools.length} dynamic specialist tools`,
      );
    }
    if (dynamicTools.length === 0) {
      console.warn(
        "[codex-app-server] Specialist catalog returned no dynamic tools",
      );
    }

    const result = (await this.request("thread/start", {
      cwd: this.cwd,
      approvalPolicy: "never",
      sandboxPolicy,
      serviceName: "dude_local",
      ...(dynamicTools.length > 0 ? { dynamicTools } : {}),
      ...params,
    })) as JsonRecord;

    const thread = result.thread as JsonRecord | undefined;
    const threadId = typeof thread?.id === "string" ? thread.id : "";
    if (!threadId) {
      throw new Error("Codex app-server did not return a thread id");
    }
    return threadId;
  }

  async startTurn(threadId: string, text: string, params: Record<string, unknown> = {}) {
    return this.request("turn/start", {
      threadId,
      input: [{ type: "text", text }],
      cwd: this.cwd,
      approvalPolicy: "never",
      sandboxPolicy: resolveCodexSandboxPolicy(this.cwd),
      ...params,
    });
  }

  async waitForTurn(
    turnId: string,
    options: { timeoutMs?: number } = {},
  ): Promise<{ status: string; error?: string }> {
    const timeoutMs = options.timeoutMs ?? 600_000;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timed out waiting for Codex turn to complete"));
      }, timeoutMs);

      const finish = (result: { status: string; error?: string }) => {
        clearTimeout(timer);
        resolve(result);
      };

      const waiters = this.turnWaiters.get(turnId) ?? [];
      waiters.push(finish);
      this.turnWaiters.set(turnId, waiters);
    });
  }

  close() {
    this.rl?.close();
    this.rl = null;
    if (this.proc && !this.proc.killed) {
      this.proc.kill("SIGTERM");
    }
    this.proc = null;
    this.readyPromise = null;
    this.initialized = false;
    for (const pending of this.pending.values()) {
      pending.reject(new Error("Codex app-server closed"));
    }
    this.pending.clear();
  }

  private async start(): Promise<void> {
    this.proc = spawn(this.codexBin, ["app-server"], {
      cwd: this.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    this.proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (!text) return;
      if (shouldLogCodexRun()) {
        logCodexLine(`stderr: ${text}`);
      } else {
        console.error(`[codex-app-server] ${text}`);
      }
    });

    this.proc.on("exit", (code, signal) => {
      if (code !== 0 && signal !== "SIGTERM") {
        console.error(`[codex-app-server] exited (code=${code}, signal=${signal})`);
      }
      for (const pending of this.pending.values()) {
        pending.reject(new Error("Codex app-server process exited"));
      }
      this.pending.clear();
      this.readyPromise = null;
      this.initialized = false;
    });

    this.rl = readline.createInterface({ input: this.proc.stdout });
    this.rl.on("line", (line) => this.handleLine(line));

    await this.sendRequest("initialize", {
      clientInfo: {
        name: "dude_local",
        title: "Dude Local",
        version: "1.0.0",
      },
      capabilities: {
        experimentalApi: true,
      },
    });
    this.notify("initialized");
    this.initialized = true;
  }

  private sendRequest(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    const payload = { method, id, params: params ?? {} };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.write(payload);
    });
  }

  private write(message: unknown) {
    if (!this.proc?.stdin.writable) {
      throw new Error("Codex app-server stdin is not writable");
    }
    this.proc.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string) {
    let message: JsonRecord;
    try {
      message = JSON.parse(line) as JsonRecord;
    } catch {
      console.error("[codex-app-server] invalid JSON:", line.slice(0, 200));
      return;
    }

    if (typeof message.id === "number") {
      if (message.error) {
        const error = message.error as JsonRecord;
        const pending = this.pending.get(message.id);
        if (pending) {
          this.pending.delete(message.id);
          pending.reject(
            new Error(
              typeof error.message === "string"
                ? error.message
                : "Codex app-server request failed",
            ),
          );
        } else if (typeof message.method === "string") {
          void this.respondToServerRequest(
            message.id,
            message.method,
            message.params,
          );
        }
        return;
      }

      if ("result" in message) {
        const pending = this.pending.get(message.id);
        if (pending) {
          this.pending.delete(message.id);
          pending.resolve(message.result);
          return;
        }
      }

      if (typeof message.method === "string") {
        void this.respondToServerRequest(
          message.id,
          message.method,
          message.params,
        );
        return;
      }
    }

    if (typeof message.method === "string") {
      this.dispatchEvent(message.method, message.params);
    }
  }

  private dispatchEvent(method: string, params: unknown) {
    if (method === "turn/completed") {
      const turn = (params as JsonRecord)?.turn as JsonRecord | undefined;
      const turnId = typeof turn?.id === "string" ? turn.id : "";
      if (turnId) {
        const waiters = this.turnWaiters.get(turnId);
        if (waiters?.length) {
          this.turnWaiters.delete(turnId);
          const status = typeof turn?.status === "string" ? turn.status : "failed";
          const errorObj = turn?.error as JsonRecord | undefined;
          const error =
            typeof errorObj?.message === "string" ? errorObj.message : undefined;
          for (const waiter of waiters) {
            waiter({ status, error });
          }
        }
      }
    }

    this.onEvent?.(method, params);
  }

  private respondToServerRequest(id: number, method: string, params?: unknown) {
    void this.handleServerRequest(id, method, params);
  }

  private async handleServerRequest(
    id: number,
    method: string,
    params?: unknown,
  ) {
    const workspaceId = process.env.WORKSPACE_ID?.trim() || "";
    const uiMode = isDudeUiModeEnabled();

    if (
      uiMode &&
      workspaceId &&
      (method === "tool/requestUserInput" ||
        method.endsWith("/requestApproval") ||
        method === "item/permissions/requestApproval")
    ) {
      try {
        const mapped = mapCodexRequestToUiInput(method, params);
        const response = await waitForUiInputRemote(workspaceId, mapped);
        this.write({
          id,
          result: mapUiResponseToCodex(method, response),
        });
        return;
      } catch (error) {
        console.error("[codex-app-server] UI input bridge failed:", error);
        this.write({
          id,
          error: {
            message:
              error instanceof Error
                ? error.message
                : "UI input request failed",
          },
        });
        return;
      }
    }

    if (method === "item/permissions/requestApproval") {
      const permissions =
        params &&
        typeof params === "object" &&
        "permissions" in (params as Record<string, unknown>)
          ? (params as Record<string, unknown>).permissions
          : {};
      this.write({
        id,
        result: {
          scope: "session",
          permissions,
        },
      });
      return;
    }

    if (method.endsWith("/requestApproval")) {
      this.write({ id, result: { decision: "acceptForSession" } });
      return;
    }

    if (method === "item/tool/call") {
      const record = asRecord(params);
      const tool = typeof record.tool === "string" ? record.tool : "";
      const args = asRecord(record.arguments);
      if (shouldLogCodexRun()) {
        logCodexLine(`dynamic tool call: ${tool}`);
      }
      activeDynamicToolTracer?.onStart(tool, args);
      try {
        const response = await executeCodexDynamicToolCall({
          threadId: String(record.threadId || ""),
          turnId: String(record.turnId || ""),
          callId: String(record.callId || ""),
          tool,
          arguments: args,
          namespace:
            typeof record.namespace === "string" ? record.namespace : null,
        });
        const resultText = response.contentItems
          .map((entry) => (entry.type === "inputText" ? entry.text : ""))
          .filter(Boolean)
          .join("\n");
        activeDynamicToolTracer?.onEnd(tool, args, resultText || "{}");
        this.write({ id, result: response });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        activeDynamicToolTracer?.onEnd(tool, args, message);
        this.write({ id, error: { message } });
      }
      return;
    }

    if (method === "tool/requestUserInput") {
      this.write({ id, result: { decision: "accept" } });
      return;
    }

    this.write({ id, result: {} });
  }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function truncateForLog(text: string, max = 80): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

function mapCodexRequestToUiInput(method: string, params: unknown) {
  const record = asRecord(params);
  const message =
    typeof record.message === "string"
      ? record.message
      : typeof record.prompt === "string"
        ? record.prompt
        : typeof record.reason === "string"
          ? record.reason
          : "The agent needs your decision to continue.";

  if (method === "tool/requestUserInput") {
    const questions = Array.isArray(record.questions) ? record.questions : [];
    const first = asRecord(questions[0]);
    const options = Array.isArray(first.options)
      ? first.options
          .map((entry, index) => {
            const row = asRecord(entry);
            const label =
              typeof row.label === "string"
                ? row.label
                : typeof row.name === "string"
                  ? row.name
                  : `Option ${index + 1}`;
            const id =
              typeof row.id === "string"
                ? row.id
                : typeof row.value === "string"
                  ? row.value
                  : `option-${index + 1}`;
            return { id, label };
          })
          .filter((entry) => entry.id && entry.label)
      : [];

    if (options.length >= 2) {
      return {
        kind: "choice" as const,
        title:
          typeof first.header === "string"
            ? first.header
            : typeof record.title === "string"
              ? record.title
              : "Choose an option",
        message:
          typeof first.question === "string"
            ? first.question
            : message,
        options,
        source: "codex/requestUserInput",
      };
    }

    return {
      kind: "question" as const,
      title:
        typeof first.header === "string"
          ? first.header
          : typeof record.title === "string"
            ? record.title
            : "Your input is needed",
      message:
        typeof first.question === "string" ? first.question : message,
      placeholder:
        typeof first.placeholder === "string" ? first.placeholder : undefined,
      source: "codex/requestUserInput",
    };
  }

  return {
    kind: "confirm" as const,
    title:
      typeof record.title === "string"
        ? record.title
        : "Approve this action?",
    message,
    source: "codex/requestApproval",
  };
}

function mapUiResponseToCodex(method: string, response: UiInputResponse) {
  if (response.action === "cancel") {
    if (method === "tool/requestUserInput") {
      return { answers: {} };
    }
    return { decision: "reject" };
  }

  if (method === "tool/requestUserInput") {
    const answers: Record<string, string> = {};
    if (response.selectedOptionId) {
      answers.choice = response.selectedOptionId;
    }
    if (response.value) {
      answers.answer = response.value;
    }
    if (typeof response.confirmed === "boolean") {
      answers.confirmed = response.confirmed ? "yes" : "no";
    }
    return { answers };
  }

  if (response.selectedOptionId) {
    return { decision: response.selectedOptionId };
  }

  if (typeof response.confirmed === "boolean") {
    return { decision: response.confirmed ? "accept" : "reject" };
  }

  return { decision: "accept" };
}

let sharedServer: CodexAppServer | null = null;
let sharedThreadId: string | null = null;

export async function getSharedCodexAppServer(
  options: CodexAppServerOptions = {},
): Promise<CodexAppServer> {
  if (!sharedServer) {
    sharedServer = new CodexAppServer(options);
  } else if (options.onEvent) {
    sharedServer.setOnEvent(options.onEvent);
  }
  await sharedServer.ensureReady();
  return sharedServer;
}

export function getSharedCodexThreadId() {
  return sharedThreadId;
}

export function setSharedCodexThreadId(threadId: string | null) {
  sharedThreadId = threadId;
}

export async function closeSharedCodexAppServer() {
  sharedServer?.close();
  sharedServer = null;
  sharedThreadId = null;
}

process.on("SIGTERM", () => {
  void closeSharedCodexAppServer();
});
process.on("SIGINT", () => {
  void closeSharedCodexAppServer();
});
