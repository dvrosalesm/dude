/**
 * Normalize runner SSE event names and payload shapes before trace folding.
 *
 * Codex/Hermes adapters emit `toolcall_*`; Pi/Cursor emit `tool_call_*`.
 * Fold aliases here so downstream handlers only implement one canonical form.
 */

import type { GatewayEvent } from './types';

const EVENT_ALIASES: Record<string, string> = {
  toolcall_start: 'tool_call_start',
  toolcall: 'tool_call',
  toolcall_end: 'tool_result',
};

function normalizeToolFields(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data };
  if (!next.tool && typeof next.name === 'string') {
    next.tool = next.name;
  }
  if (!next.tool && typeof next.toolName === 'string') {
    next.tool = next.toolName;
  }
  return next;
}

export function normalizeGatewayEvent(evt: GatewayEvent): GatewayEvent {
  const event = EVENT_ALIASES[evt.event] ?? evt.event;

  if (
    event !== 'tool_call_start' &&
    event !== 'tool_call' &&
    event !== 'tool_result'
  ) {
    return event === evt.event ? evt : { event, data: evt.data };
  }

  return {
    event,
    data: normalizeToolFields(evt.data),
  };
}
