/**
 * Per-turn control channel for agent-driven progress + explicit finish.
 *
 * Tools (`send_progress`, `finish_turn`) use this to stream user-visible
 * updates and end the turn when the agent is ready — instead of the runtime
 * guessing from the first text chunk or turn/completed.
 */

export type TurnFinishPayload = {
  answer: string;
  suggestions?: string[];
};

export type TurnControlHooks = {
  emitProgress: (message: string) => void;
  requestAbort: () => void;
};

export type ActiveTurnControl = TurnControlHooks & {
  progressMessages: string[];
  finish?: TurnFinishPayload;
};

let activeTurn: ActiveTurnControl | null = null;

export function beginActiveTurn(hooks: TurnControlHooks): void {
  activeTurn = {
    ...hooks,
    progressMessages: [],
  };
}

export function endActiveTurn(): void {
  activeTurn = null;
}

export function getActiveTurnControl(): ActiveTurnControl | null {
  return activeTurn;
}

export function recordProgressMessage(message: string): void {
  if (!activeTurn) return;
  activeTurn.progressMessages.push(message);
  activeTurn.emitProgress(message);
}

export function recordTurnFinish(payload: TurnFinishPayload): void {
  if (!activeTurn) return;
  activeTurn.finish = payload;
  activeTurn.requestAbort();
}
