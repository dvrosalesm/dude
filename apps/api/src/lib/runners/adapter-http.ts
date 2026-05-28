/**
 * Shared HTTP helpers for runner adapter child processes.
 * Each adapter (pi, codex, hermes) implements the same surface documented in
 * @dude/sdk/runner — AGENT_RUNNER_HTTP_ROUTES.
 */

import http from "node:http";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { logCodexLine, shouldLogCodexRun } from "./codex-run-logger.js";
import { writeGatewayMarker } from "../agent-gateway-marker.js";
import {
  applyRunnerSessionManifestToEnv,
  readRunnerSessionManifest,
} from "../runner-session-manifest.js";

export type GatewayMessage = { role: string; content: string };

export type ChatHandler = (input: {
  message: string;
  history?: GatewayMessage[];
  images?: string[];
  sendEvent: (event: string, data: unknown) => void;
}) => Promise<Record<string, unknown>>;

export type BufferedEvent = { event: string; data: unknown };

export interface ChatStateSnapshot {
  chatId: string;
  status: "idle" | "processing" | "completed" | "error";
  startedAt: string;
  endedAt?: string;
  eventCount: number;
  events: BufferedEvent[];
  result?: Record<string, unknown>;
  error?: string;
}

const MAX_BUFFERED_EVENTS = 5000;

/** Serialize agent turns — concurrent POST /v1/chat calls corrupt shared runner state. */
let chatTurnChain: Promise<void> = Promise.resolve();

function enqueueChatTurn<T>(fn: () => Promise<T>): Promise<T> {
  const run = chatTurnChain.then(() => fn());
  chatTurnChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function createChatStateBuffer() {
  let current: ChatStateSnapshot = {
    chatId: "",
    status: "idle",
    startedAt: "",
    eventCount: 0,
    events: [],
  };

  function reset(chatId: string) {
    current = {
      chatId,
      status: "processing",
      startedAt: new Date().toISOString(),
      eventCount: 0,
      events: [],
    };
  }

  function record(event: string, data: unknown) {
    if (current.status !== "processing") return;
    current.events.push({ event, data });
    current.eventCount += 1;
    if (current.events.length > MAX_BUFFERED_EVENTS) {
      current.events.splice(0, current.events.length - MAX_BUFFERED_EVENTS);
    }
  }

  function complete(result: Record<string, unknown>) {
    current.status = "completed";
    current.endedAt = new Date().toISOString();
    current.result = result;
  }

  function fail(error: string) {
    current.status = "error";
    current.endedAt = new Date().toISOString();
    current.error = error;
  }

  function snapshot(since: number) {
    const dropped = current.eventCount - current.events.length;
    const sliceFrom = Math.max(0, since - dropped);
    return {
      chatId: current.chatId,
      status: current.status,
      startedAt: current.startedAt,
      endedAt: current.endedAt ?? null,
      eventCount: current.eventCount,
      events: current.events.slice(sliceFrom),
      result: current.result ?? null,
      error: current.error ?? null,
    };
  }

  return { reset, record, complete, fail, snapshot, isProcessing: () => current.status === 'processing' };
}

export async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export interface AdapterServerOptions {
  runnerId: string;
  port: number;
  modelLabel?: string;
  onChat: ChatHandler;
  onQuery?: (query: string) => unknown;
}

export function startAdapterServer(options: AdapterServerOptions) {
  const chatState = createChatStateBuffer();
  const manifestPath = process.env.DUDE_SESSION_MANIFEST_PATH?.trim();

  if (!manifestPath) {
    console.error(
      `[${options.runnerId}-gateway] DUDE_SESSION_MANIFEST_PATH is required — refusing to start`,
    );
    process.exit(1);
  }

  let manifest;
  try {
    manifest = readRunnerSessionManifest(manifestPath);
  } catch (error) {
    console.error(
      `[${options.runnerId}-gateway] invalid runner session manifest:`,
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }

  applyRunnerSessionManifestToEnv(manifest, manifestPath);
  console.log(
    `[${options.runnerId}-gateway] session ${manifest.sessionId} · internal ${manifest.internalApi.baseUrl} · db ${manifest.internalApi.dbPath}`,
  );
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { ...cors, "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          runner: options.runnerId,
          model: options.modelLabel ?? options.runnerId,
        }),
      );
      return;
    }

    if (req.url?.startsWith("/v1/chat/state") && req.method === "GET") {
      try {
        const url = new URL(req.url, "http://localhost");
        const sinceRaw = url.searchParams.get("since");
        const since = sinceRaw === null ? 0 : Math.max(0, parseInt(sinceRaw, 10) || 0);
        res.writeHead(200, { ...cors, "Content-Type": "application/json" });
        res.end(JSON.stringify(chatState.snapshot(since)));
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        res.writeHead(500, { ...cors, "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: msg }));
      }
      return;
    }

    if (req.url?.startsWith("/v1/query") && req.method === "POST") {
      if (!options.onQuery) {
        res.writeHead(501, { ...cors, "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "query not supported by this runner" }));
        return;
      }
      try {
        const body = JSON.parse(await readBody(req));
        const query = String(body.query || "");
        if (!query) {
          res.writeHead(400, { ...cors, "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "query is required" }));
          return;
        }
        const result = options.onQuery(query);
        res.writeHead(200, { ...cors, "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        res.writeHead(500, { ...cors, "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: msg }));
      }
      return;
    }

    if (req.url === "/v1/chat" && req.method === "POST") {
      try {
        const body = JSON.parse(await readBody(req));
        const message = String(body.message || "");
        const history: GatewayMessage[] = Array.isArray(body.history)
          ? body.history.filter((m: unknown) => {
              if (!m || typeof m !== "object") return false;
              const row = m as Record<string, unknown>;
              return typeof row.role === "string" && typeof row.content === "string";
            })
          : [];
        const images: string[] = Array.isArray(body.images)
          ? body.images.filter((u: unknown) => typeof u === "string")
          : [];

        if (!message) {
          res.writeHead(400, { ...cors, "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "message is required" }));
          return;
        }

        const chatId = randomUUID();

        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "X-Chat-Id": chatId,
        });

        const keepAlive = setInterval(() => {
          if (res.writableEnded || res.destroyed) return;
          try {
            res.write(": ka\n\n");
          } catch {
            /* socket gone */
          }
        }, 15_000);

        function sendEvent(event: string, data: unknown) {
          chatState.record(event, data);
          if (res.writableEnded || res.destroyed) return;
          try {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          } catch {
            /* consumer disconnected */
          }
        }

        try {
          const donePayload = await enqueueChatTurn(async () => {
            chatState.reset(chatId);
            if (options.runnerId === "codex" && shouldLogCodexRun()) {
              logCodexLine(
                `POST /v1/chat ${message.slice(0, 200)}${message.length > 200 ? "…" : ""}`,
              );
            }
            return options.onChat({
              message,
              history,
              images,
              sendEvent,
            });
          });
          sendEvent("done", donePayload);
          chatState.complete(donePayload);
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          sendEvent("error", { message: msg });
          chatState.fail(msg);
          sendEvent("done", { type: "final", answer: "", steps: [], error: msg });
          chatState.complete({ type: "final", answer: "", steps: [], error: msg });
        } finally {
          clearInterval(keepAlive);
          if (!res.writableEnded) res.end();
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (!res.headersSent) {
          res.writeHead(500, { ...cors, "Content-Type": "application/json" });
        }
        res.end(JSON.stringify({ error: msg }));
      }
      return;
    }

    res.writeHead(404, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(options.port, "127.0.0.1", () => {
    try {
      writeGatewayMarker(process.cwd(), {
        port: options.port,
        pid: process.pid,
        runner: options.runnerId,
        startedAt: new Date().toISOString(),
      });
    } catch {
      // non-fatal
    }
    console.log(
      `[${options.runnerId}-gateway] listening on 127.0.0.1:${options.port}`,
    );
    if (options.runnerId === "codex" && shouldLogCodexRun()) {
      logCodexLine(
        "gateway ready — send a chat message to start a turn; output will stream here",
      );
    }
  });

  return server;
}
