/**
 * Centralized trace event handler.
 *
 * The Pi runner streams a sequence of SSE events for each agent run
 * (thinking_start / thinking / tool_call_start / tool_call / tool_result /
 * text_delta). This module folds that stream into a flat `steps` log and
 * a `toolExecutions` array — the same shape both controllers persist and
 * the UI renders as the trace timeline.
 *
 * Runner-specific event aliases (`toolcall_*`) are normalized at ingress in
 * `gateway-event-normalize.ts` before events reach this module.
 *
 * Two responsibilities live here so the assistant and instances controllers
 * stay in sync:
 *   1. Translate raw tool names into friendly progress sentences.
 *   2. Accumulate `thinking` deltas (streaming tokens) into a single
 *      readable thought, instead of overwriting the step with the latest
 *      one-token chunk.
 */

import type { GatewayEvent } from './types';
import { friendlyToolLabel, isActiveStep } from '@dude/gateway-shared/tool-labels';

export interface ToolExecution {
  tool: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

export interface TraceState {
  steps: string[];
  toolExecutions: ToolExecution[];
  /** Accumulator for the in-flight thinking message — reset between turns. */
  thinkingBuffer: string;
}

export function createTraceState(): TraceState {
  return { steps: [], toolExecutions: [], thinkingBuffer: '' };
}

const COMPOSING_LABEL = 'Composing the response…';
const THINKING_LABEL = 'Thinking…';
const SILENT_TRACE_TOOLS = new Set(['send_progress', 'finish_turn']);

function isSilentTraceTool(tool: string): boolean {
  return SILENT_TRACE_TOOLS.has(tool);
}

function isGenericThinkingStep(step: string | undefined): boolean {
  if (!step) return false;
  return (
    step === THINKING_LABEL ||
    step === 'Thinking...' ||
    step === COMPOSING_LABEL
  );
}

function pushUniqueStep(state: TraceState, step: string): void {
  const trimmed = step.trim();
  if (!trimmed) return;
  const last = state.steps[state.steps.length - 1];
  if (last === trimmed) return;
  state.steps.push(trimmed);
}

function toolNameFromEvent(data: Record<string, unknown>): string {
  return String(data.tool || data.name || '');
}

export function applyTraceEvent(state: TraceState, evt: GatewayEvent): void {
  switch (evt.event) {
    case 'thinking_start':
      state.thinkingBuffer = '';
      if (!isGenericThinkingStep(state.steps[state.steps.length - 1])) {
        pushUniqueStep(state, THINKING_LABEL);
      }
      break;

    case 'thinking': {
      const delta = evt.data.delta;
      if (typeof delta !== 'string' || !delta) break;
      state.thinkingBuffer += delta;
      const text = state.thinkingBuffer.trim();
      if (!text) break;
      const last = state.steps[state.steps.length - 1];
      if (last === THINKING_LABEL || last === text || isThinkingStep(last, state.thinkingBuffer)) {
        state.steps[state.steps.length - 1] = text;
      } else {
        state.steps.push(text);
      }
      break;
    }

    case 'thinking_end':
      // The accumulated thinking already lives in steps; reset the buffer
      // so the next thinking turn starts fresh.
      state.thinkingBuffer = '';
      break;

    case 'tool_call_start': {
      const tool = toolNameFromEvent(evt.data);
      if (isSilentTraceTool(tool)) break;
      pushUniqueStep(state, friendlyToolLabel(tool).active);
      break;
    }

    case 'tool_call': {
      const tool = toolNameFromEvent(evt.data);
      if (isSilentTraceTool(tool)) break;
      const args = (evt.data.arguments as Record<string, unknown>) || {};
      const label = friendlyToolLabel(tool, args).active;

      const last = state.steps[state.steps.length - 1];
      if (
        state.steps.length > 0 &&
        (last === friendlyToolLabel(tool).active ||
          last?.startsWith('Calling ') ||
          isActiveStep(last))
      ) {
        state.steps[state.steps.length - 1] = label;
      } else {
        state.steps.push(label);
      }

      // Avoid duplicate entries when both toolcall_end and tool_use fire
      // for the same call: update the still-pending entry in place.
      const lastExec = state.toolExecutions[state.toolExecutions.length - 1];
      if (lastExec && lastExec.tool === tool && lastExec.result == null) {
        lastExec.arguments = args || lastExec.arguments;
      } else {
        state.toolExecutions.push({ tool, arguments: args, result: null });
      }
      break;
    }

    case 'user_input_required': {
      const title = String(evt.data.title || 'Waiting for your input…');
      if (!state.steps.includes(title)) {
        state.steps.push(title);
      }
      break;
    }

    case 'user_input_resolved':
      break;

    case 'tool_result': {
      const toolName = toolNameFromEvent(evt.data);
      if (isSilentTraceTool(toolName)) break;
      let target: ToolExecution | null =
        state.toolExecutions.length > 0
          ? state.toolExecutions[state.toolExecutions.length - 1]
          : null;
      if (toolName) {
        const match = [...state.toolExecutions]
          .reverse()
          .find((e) => e.tool === toolName && e.result == null);
        if (match) target = match;
      }
      if (target) {
        try {
          target.result = JSON.parse(String(evt.data.result));
        } catch {
          target.result = evt.data.result;
        }
        // Flip the matching active step into its past-tense form.
        const activeLabel = friendlyToolLabel(target.tool, target.arguments).active;
        const pastLabel = friendlyToolLabel(target.tool, target.arguments).past;
        for (let i = state.steps.length - 1; i >= 0; i--) {
          if (state.steps[i] === activeLabel) {
            state.steps[i] = pastLabel;
            break;
          }
        }
      }
      break;
    }

    case 'progress_message': {
      const text = String(evt.data.message || '').trim();
      if (!text) break;
      const last = state.steps[state.steps.length - 1];
      if (last === text) break;
      pushUniqueStep(state, text);
      break;
    }

    case 'heartbeat':
      break;

    case 'compaction': {
      const tokens = evt.data.tokensBefore;
      const label =
        typeof tokens === 'number'
          ? `Compacted earlier history (~${tokens} tokens)`
          : 'Compacted earlier history';
      pushUniqueStep(state, label);
      break;
    }

    case 'error': {
      const message = String(
        evt.data.message || evt.data.error || 'Agent error',
      ).trim();
      if (message) {
        pushUniqueStep(state, message.startsWith('Error:') ? message : `Error: ${message}`);
      }
      break;
    }

    case 'preview_draft': {
      const size = evt.data.size;
      const label =
        typeof size === 'number'
          ? `Drafting page preview (${(size / 1024).toFixed(1)}KB)`
          : 'Drafting page preview…';
      pushUniqueStep(state, label);
      break;
    }

    case 'text_delta': {
      if (!state.steps.includes(COMPOSING_LABEL)) {
        state.steps.push(COMPOSING_LABEL);
      }
      break;
    }
  }
}

function isThinkingStep(step: string | undefined, buffer: string): boolean {
  if (!step) return false;
  // The previous step is "thinking" if it's a prefix of the current accumulation
  // (within reason — we only check the first 32 chars to keep it cheap).
  const head = buffer.trim().slice(0, 32);
  return head.length > 0 && step.startsWith(head);
}
