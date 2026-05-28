/**
 * Shared types for subagent chat UIs.
 * Used by data analyst, marketing, and future subagents.
 */

export type SubagentMessage = {
  message: string;
  role: string;
  date?: string;
  images?: string[];
  steps?: string[];
  answer?: string;
  /** Full execution trace from the agent loop. */
  executionTrace?: ExecutionTrace;
  /** Actionable suggestions the user can click to send as a new message. */
  suggestions?: string[];
  /** Hide from UI (e.g. system boot messages). */
  hidden?: boolean;
  /** DB message ID (for persistent threads). */
  id?: string;
  /** Whether this message is pinned/bookmarked. */
  pinned?: boolean;
  /** Element references attached at send time (Design mode picks). Local-only; not persisted. */
  attachedRefs?: Array<{ label: string }>;
  /**
   * Non-image file attachments (PDF, CSV, DOCX, etc.) the user dropped in
   * the input bar. Local-only and ephemeral: rendered as file pills under
   * the user bubble so they can confirm what they sent. We do NOT push the
   * file bytes through the agent loop — non-tabular files are not
   * processed by GT today, and tabular files use the dedicated import
   * wizard. Only `name` and `mimeType` are kept; that's all the renderer
   * needs and avoids stuffing megabytes of base64 into local state.
   */
  files?: Array<{ name: string; mimeType: string }>;
};

export type ChatImageAttachment = {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  /** True while the image is being uploaded locally. */
  uploading?: boolean;
};

export type FileReference = {
  id: string;
  name: string;
  content: string;
};

export type ExecutionTrace = {
  id: string;
  timestamp: string;
  steps: string[];
  toolExecutions: Array<{
    tool: string;
    arguments: Record<string, unknown>;
    result: unknown;
  }>;
  durationMs: number;
};
