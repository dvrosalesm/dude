/**
 * Human-readable Codex run logging for tmux / terminal attach sessions.
 * Enabled when DUDE_CODEX_LOG=1, running inside tmux, or stdout is a TTY.
 */

import { extractAgentMessageText } from "./codex-message-utils.js";

let streamingLine = false;

export function shouldLogCodexRun(): boolean {
  const flag = process.env.DUDE_CODEX_LOG?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  if (flag === "1" || flag === "true" || flag === "on") return true;
  return Boolean(process.env.TMUX) || process.stdout.isTTY;
}

function endStreamLine() {
  if (streamingLine) {
    process.stdout.write("\n");
    streamingLine = false;
  }
}

export function logCodexLine(message: string) {
  if (!shouldLogCodexRun()) return;
  endStreamLine();
  console.log(`[codex] ${message}`);
}

export function logCodexStream(delta: string) {
  if (!shouldLogCodexRun() || !delta) return;
  if (!streamingLine) {
    process.stdout.write("[codex] ");
    streamingLine = true;
  }
  process.stdout.write(delta);
}

export function logCodexRpc(method: string, detail?: string) {
  if (!shouldLogCodexRun()) return;
  logCodexLine(detail ? `→ ${method} (${detail})` : `→ ${method}`);
}

function truncate(text: string, max = 2400): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}… [${trimmed.length} chars total]`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function logCodexEvent(method: string, params: unknown) {
  if (!shouldLogCodexRun()) return;

  const record = asRecord(params);
  const item = asRecord(record.item);

  switch (method) {
    case "turn/started": {
      const turn = asRecord(record.turn);
      logCodexLine(`turn started ${String(turn.id || "")}`.trim());
      break;
    }

    case "item/agentMessage/delta": {
      const delta =
        typeof record.delta === "string"
          ? record.delta
          : typeof record.text === "string"
            ? record.text
            : "";
      if (delta) logCodexStream(delta);
      break;
    }

    case "item/started": {
      if (typeof item.type !== "string") break;
      if (item.type === "commandExecution") {
        const command =
          typeof item.command === "string" ? item.command : "(command)";
        logCodexLine(`$ ${truncate(command, 1200)}`);
      } else if (item.type === "mcpToolCall") {
        logCodexLine(`tool ${String(item.tool || "mcp")}`);
      } else if (item.type === "agentMessage") {
        const text = extractAgentMessageText(item);
        if (text) logCodexLine(`assistant: ${truncate(text, 800)}`);
      } else if (
        item.type === "imageGeneration" ||
        item.type === "image_generation_call"
      ) {
        logCodexLine("image generation");
      } else {
        logCodexLine(`item ${item.type}`);
      }
      break;
    }

    case "item/completed":
    case "rawResponseItem/completed": {
      if (typeof item.type !== "string") break;
      if (item.type === "commandExecution") {
        const output =
          typeof item.aggregatedOutput === "string"
            ? item.aggregatedOutput
            : typeof item.status === "string"
              ? item.status
              : "";
        if (output) {
          logCodexLine(`↳ ${truncate(output, 2400)}`);
        }
      } else if (item.type === "mcpToolCall") {
        const result = item.result ?? item.error ?? item.status;
        if (result !== undefined) {
          logCodexLine(
            `↳ ${truncate(typeof result === "string" ? result : JSON.stringify(result), 1200)}`,
          );
        }
      } else if (item.type === "agentMessage") {
        const text = extractAgentMessageText(item);
        if (text) logCodexLine(`assistant (final): ${truncate(text, 1200)}`);
      } else if (
        item.type !== "imageGeneration" &&
        item.type !== "image_generation_call"
      ) {
        logCodexLine(`done ${item.type}`);
      }
      break;
    }

    case "turn/completed": {
      const turn = asRecord(record.turn);
      const status = typeof turn.status === "string" ? turn.status : "unknown";
      const errorObj = asRecord(turn.error);
      const error =
        typeof errorObj.message === "string" ? errorObj.message : undefined;
      logCodexLine(error ? `turn ${status}: ${error}` : `turn ${status}`);
      endStreamLine();
      break;
    }

    default:
      logCodexLine(`${method} ${truncate(JSON.stringify(params ?? {}), 400)}`);
      break;
  }
}

export function logCodexRunStart(input: {
  message: string;
  threadId: string;
  turnId?: string;
}) {
  logCodexLine(`chat: ${truncate(input.message, 500)}`);
  logCodexLine(`thread ${input.threadId}${input.turnId ? ` · turn ${input.turnId}` : ""}`);
}

export function logCodexRunFinish(input: {
  answer: string;
  steps: string[];
  error?: string;
}) {
  endStreamLine();
  if (input.error) {
    logCodexLine(`failed: ${input.error}`);
    return;
  }
  if (input.answer) {
    logCodexLine(`answer: ${truncate(input.answer, 2400)}`);
  }
  if (input.steps.length) {
    logCodexLine(`steps: ${input.steps.length}`);
  }
}
