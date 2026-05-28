/**
 * Gateway Client
 *
 * Sends messages to a running agent child process and collects events.
 * The child process runs the full agent loop autonomously — this client
 * consumes the SSE stream and calls back with trace updates.
 *
 * Uses a per-read idle timeout instead of an overall timeout, so long
 * but active agent runs (research + generation) never get killed.
 */

import type {
  GatewayResponse,
  GatewayUsage,
  GatewayResult,
  GatewayEvent,
} from './types';
import { AGENT_CHAT_TURN_TIMEOUT_MS } from '@dude/sdk/runner';
import { normalizeGatewayEvent } from './gateway-event-normalize.js';

// If no data arrives for this long, assume the agent is stuck.
// Must be generous — tool call arg generation (e.g. 25KB+ HTML) can take 10+ min
// with no SSE events emitted until the full args are complete.

const STATE_POLL_INTERVAL_MS = 1000;
/** Consecutive connection failures before giving up (~30s). */
const STATE_POLL_CONNECT_FAILURE_LIMIT = 30;
/** Consecutive 502/503 responses before giving up (~15s). */
const STATE_POLL_TRANSIENT_HTTP_LIMIT = 15;

const AGENT_EXITED_ERROR =
  'Agent process exited before the turn finished. Send your message again to restart the agent.';

const AGENT_UNREACHABLE_ERROR =
  'Lost connection to the agent while the turn was still running. ' +
  'If you use tmux, attach to the agent session to verify it is still working, then send your message again.';

function isRecoverableStreamError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('terminated') ||
    msg.includes('aborted') ||
    msg.includes('other side closed') ||
    msg.includes('socket hang up') ||
    msg.includes('econnreset') ||
    msg.includes('network')
  );
}

function emitGatewayEvent(
  onEvent: ((event: GatewayEvent) => void) | undefined,
  event: string,
  data: Record<string, unknown>,
) {
  onEvent?.(normalizeGatewayEvent({ event, data }));
}

function normalizeDoneImages(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const urls = value
    .map((entry) => {
      if (typeof entry === "string" && entry.trim()) return entry.trim();
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const url =
          typeof record.url === "string"
            ? record.url
            : typeof record.src === "string"
              ? record.src
              : "";
        return url.trim();
      }
      return "";
    })
    .filter(Boolean);
  return urls.length > 0 ? urls : undefined;
}

function buildResultFromDonePayload(
  donePayload: Record<string, unknown>,
): GatewayResult {
  const response: GatewayResponse = {
    type: (donePayload.type as string) === 'question' ? 'question' : 'final',
    steps: Array.isArray(donePayload.steps)
      ? (donePayload.steps as string[])
      : [],
    answer: donePayload.answer as string | undefined,
    question: donePayload.question as string | undefined,
    images: normalizeDoneImages(donePayload.images),
  };

  const rawUsage = donePayload.usage as Record<string, unknown> | undefined;
  const usage: GatewayUsage = {
    inputTokens: Number(rawUsage?.input_tokens) || 0,
    outputTokens: Number(rawUsage?.output_tokens) || 0,
    cacheReadTokens: Number(rawUsage?.cache_read_tokens) || 0,
    cacheWriteTokens: Number(rawUsage?.cache_write_tokens) || 0,
    totalCost: Number(rawUsage?.total_cost) || 0,
    model: 'unknown',
  };

  return {
    response,
    usage,
    rawContent: response.answer || JSON.stringify(donePayload),
  };
}

/**
 * Recover an in-flight chat by polling the agent's `/v1/chat/state` buffer.
 *
 * Used as a fallback when the SSE stream from the agent dies mid-turn (e.g.
 * undici's "terminated" socket error). The agent's session keeps running in
 * the same process and mirrors every event it emits into a module-level
 * buffer; this function drains the missed events from `since` onwards and
 * blocks until the buffer reports `status === "completed" | "error"`.
 *
 * `since` is the count of events the caller has already consumed before the
 * SSE stream broke — so polling resumes from exactly where it lost track.
 */
export async function pollAgentChatStateUntilDone(
  gatewayHost: string,
  gatewayPort: number,
  since: number,
  onEvent?: (event: GatewayEvent) => void,
): Promise<GatewayResult> {
  const stateUrl = `http://${gatewayHost}:${gatewayPort}/v1/chat/state`;
  let cursor = since;
  let connectFailures = 0;
  let transientHttpFailures = 0;
  const deadline = Date.now() + AGENT_CHAT_TURN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, STATE_POLL_INTERVAL_MS));

    let res: Response;
    try {
      res = await fetch(`${stateUrl}?since=${cursor}`, {
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      connectFailures++;
      if (connectFailures >= STATE_POLL_CONNECT_FAILURE_LIMIT) {
        throw new Error(AGENT_UNREACHABLE_ERROR);
      }
      continue;
    }

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(AGENT_EXITED_ERROR);
      }
      if (res.status === 502 || res.status === 503) {
        transientHttpFailures++;
        if (transientHttpFailures >= STATE_POLL_TRANSIENT_HTTP_LIMIT) {
          throw new Error(AGENT_UNREACHABLE_ERROR);
        }
        continue;
      }
      transientHttpFailures++;
      if (transientHttpFailures >= STATE_POLL_TRANSIENT_HTTP_LIMIT) {
        throw new Error(`Agent state polling failed (${res.status})`);
      }
      continue;
    }
    connectFailures = 0;
    transientHttpFailures = 0;

    const state = (await res.json()) as {
      status: 'idle' | 'processing' | 'completed' | 'error';
      eventCount?: number;
      events?: BufferedEvent[];
      result?: Record<string, unknown> | null;
      error?: string | null;
    };

    if (Array.isArray(state.events) && state.events.length > 0) {
      for (const evt of state.events) {
        const data =
          evt.data && typeof evt.data === 'object' && !Array.isArray(evt.data)
            ? (evt.data as Record<string, unknown>)
            : ({} as Record<string, unknown>);
        emitGatewayEvent(onEvent, evt.event, data);
      }
    }
    if (typeof state.eventCount === 'number') {
      cursor = state.eventCount;
    } else if (Array.isArray(state.events) && state.events.length > 0) {
      cursor += state.events.length;
    }

    if (state.status === 'completed') {
      const donePayload = state.result || {};
      return buildResultFromDonePayload(donePayload);
    }

    if (state.status === 'error') {
      throw new Error(state.error || 'Agent error during recovery');
    }

    if (state.status === 'idle') {
      // The buffer was reset — likely a new chat started or the agent restarted.
      throw new Error('Chat no longer in progress on the agent');
    }
    // status === 'processing' — keep polling.
  }

  throw new Error('Chat turn timed out while waiting for the agent to finish.');
}

interface BufferedEvent {
  event: string;
  data: unknown;
}

/**
 * Send a message to the agent gateway and collect all events.
 *
 * Consumes the SSE stream, calling `onEvent` for each event
 * (thinking, tool calls, text deltas, etc.) so the caller can track progress.
 *
 * No overall timeout — only aborts after AGENT_CHAT_TURN_TIMEOUT_MS without data.
 */
export async function sendMessage(
  gatewayHost: string,
  gatewayPort: number,
  request: { message: string; history?: unknown[]; images?: string[] },
  onEvent?: (event: GatewayEvent) => void,
): Promise<GatewayResult> {
  const url = `http://${gatewayHost}:${gatewayPort}/v1/chat`;

  // Use a manually managed AbortController — reset on each chunk received
  const controller = new AbortController();
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), AGENT_CHAT_TURN_TIMEOUT_MS);
  }

  resetIdleTimer();

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch (err) {
    if (idleTimer) clearTimeout(idleTimer);
    throw err;
  }

  if (!res.ok) {
    if (idleTimer) clearTimeout(idleTimer);
    const errorText = await res.text();
    throw new Error(`Gateway error (${res.status}): ${errorText}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let donePayload: Record<string, unknown> | null = null;
  let eventsConsumed = 0;

  const trackEvent = (event: string, data: Record<string, unknown>) => {
    if (event !== 'done') eventsConsumed += 1;
    emitGatewayEvent(onEvent, event, data);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Data received — reset idle timer
      resetIdleTimer();

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        let eventType = '';
        let eventData = '';

        for (const line of part.split('\n')) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim();
          else if (line.startsWith('data: ')) eventData = line.slice(6);
        }

        if (!eventType || !eventData) continue;

        try {
          const parsed = JSON.parse(eventData) as Record<string, unknown>;
          if (eventType === 'done') {
            donePayload = parsed;
          }
          trackEvent(eventType, parsed);
        } catch {
          // Malformed JSON, skip
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      let eventType = '';
      let eventData = '';
      for (const line of buffer.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim();
        else if (line.startsWith('data: ')) eventData = line.slice(6);
      }
      if (eventType && eventData) {
        try {
          const parsed = JSON.parse(eventData) as Record<string, unknown>;
          if (eventType === 'done') donePayload = parsed;
          trackEvent(eventType, parsed);
        } catch {
          // Malformed JSON
        }
      }
    }
  } catch (error) {
    if (idleTimer) clearTimeout(idleTimer);
    if (isRecoverableStreamError(error)) {
      console.warn(
        `[Gateway] SSE stream broke after ${eventsConsumed} events: ${
          error instanceof Error ? error.message : String(error)
        }; attempting recovery via state poll`,
      );
      return pollAgentChatStateUntilDone(
        gatewayHost,
        gatewayPort,
        eventsConsumed,
        onEvent,
      );
    }
    throw error;
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
  }

  if (!donePayload) {
    console.warn(
      `[Gateway] SSE stream ended without done after ${eventsConsumed} events; attempting recovery via state poll`,
    );
    return pollAgentChatStateUntilDone(
      gatewayHost,
      gatewayPort,
      eventsConsumed,
      onEvent,
    );
  }

  return buildResultFromDonePayload(donePayload);
}
