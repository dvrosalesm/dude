/**
 * Specialist-call tool — registered once per enabled subagent on the
 * main assistant (GT). When invoked, the GT delegates work to the named
 * subagent by hitting an internal gateway endpoint that runs that
 * subagent's assistant loop and returns its final answer.
 *
 * This tool also owns the GT project session bookkeeping so the agent
 * doesn't have to remember it on every turn:
 *
 *   1. Before delegation, it reads the GT's `gtSession` singleton and
 *      prepends an "Upstream artifacts" block to the `context` so the
 *      called subagent knows which sibling workspaces it can pull from
 *      via `read_subagent_artifact`.
 *
 *   2. After a successful run, it merges
 *      `{ workspaceId, workspaceName, lastInvokedAt }` into
 *      `gtSession.specialists[subagentId]` so subsequent turns reuse
 *      the same workspace without re-asking the user.
 *
 * The agent only writes the message; the tool handles the bookkeeping.
 */

import { Type } from "@sinclair/typebox";
import { config } from "@dude/sdk/gateway-runtime";
import { internalGet, internalPost } from "@dude/sdk/gateway-runtime";
import type { ToolDefinition } from "../types.js";
import { getOrgUser, isApiError, toolError, toolText } from "./_shared.js";

export interface SubagentToolMeta {
  /** Subagent id, e.g. "document-writer". */
  subagentId: string;
  /** Human-friendly label. */
  label?: string;
  /** One-line description of what this subagent is best at. */
  description?: string;
}

interface SessionEntry {
  workspaceId: string;
  workspaceName?: string;
  lastInvokedAt: string;
  lastTask?: string;
  lastAnswer?: string;
}

interface GtSession {
  projectName?: string;
  subagents?: Record<string, SessionEntry>;
  createdAt?: string;
  updatedAt?: string;
}

async function readGtSession(): Promise<GtSession | null> {
  if (!config.workspaceId) return null;
  const result = await internalGet(
    `/workspace/${config.workspaceId}/collection/gtSession`,
  );
  if (isApiError(result)) return null;
  // The collection endpoint returns the singleton value directly under
  // `gtSession`. Be defensive about shape — older sessions may be empty.
  const raw = (result as Record<string, unknown>).gtSession;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as GtSession;
}

async function writeGtSession(session: GtSession): Promise<void> {
  if (!config.workspaceId) return;
  await internalPost(`/workspace/${config.workspaceId}/collection`, {
    collection: "gtSession",
    data: session,
  });
}

/**
 * Build the upstream-artifacts block injected ahead of the user's context.
 * Excludes the subagent being called (it doesn't need to be told about
 * its own workspace) and is a no-op when no other subagents are linked.
 */
function buildUpstreamBlock(
  session: GtSession | null,
  callingSubagent: string,
): string | null {
  const subagents = session?.subagents ?? {};
  const lines: string[] = [];
  for (const [id, entry] of Object.entries(subagents)) {
    if (id === callingSubagent) continue;
    if (!entry?.workspaceId) continue;
    const label = entry.workspaceName
      ? `${id} (${entry.workspaceName})`
      : id;
    lines.push(`- ${label} — workspaceId: \`${entry.workspaceId}\``);
  }
  if (lines.length === 0) return null;
  return [
    "## Upstream artifacts",
    "",
    "These sibling subagents have produced state in the current GT project. " +
      "Use `read_subagent_artifact` with the workspaceId to pull a specific " +
      "collection (cheaper) or omit the collection to read the whole config.",
    "",
    ...lines,
  ].join("\n");
}

/**
 * Merge a new subagent invocation into the GT's gtSession singleton.
 * Reads → merges → writes. Best-effort: failures are non-fatal.
 */
async function recordInvocation(params: {
  subagentId: string;
  workspaceId: string;
  workspaceName?: string;
  lastTask?: string;
  lastAnswer?: string;
}): Promise<void> {
  try {
    const now = new Date().toISOString();
    const existing = (await readGtSession()) ?? {};
    const prev = existing.subagents?.[params.subagentId];
    const next: GtSession = {
      ...existing,
      createdAt: existing.createdAt ?? now,
      updatedAt: now,
      subagents: {
        ...(existing.subagents ?? {}),
        [params.subagentId]: {
          workspaceId: params.workspaceId,
          ...(params.workspaceName
            ? { workspaceName: params.workspaceName }
            : prev?.workspaceName
              ? { workspaceName: prev.workspaceName }
              : {}),
          lastInvokedAt: now,
          ...(params.lastTask ? { lastTask: params.lastTask.slice(0, 500) } : {}),
          ...(params.lastAnswer
            ? { lastAnswer: params.lastAnswer.slice(0, 800) }
            : {}),
        },
      },
    };
    await writeGtSession(next);
  } catch {
    // Non-fatal — the subagent already ran successfully.
  }
}

/**
 * Build a tool that, when called, runs a subagent and returns its answer.
 */
export function createSubagentCallTool(
  meta: SubagentToolMeta,
): () => ToolDefinition {
  return () => ({
    name: meta.subagentId,
    label: meta.label || meta.subagentId,
    description:
      meta.description ||
      `Delegate a task to the "${meta.subagentId}" subagent. ` +
        `Provide a clear, self-contained prompt. The subagent runs its ` +
        `own assistant loop and returns a final answer. The tool also ` +
        `auto-injects upstream artifacts from gtSession into context and ` +
        `auto-updates gtSession on success — you don't need to do either ` +
        `manually.`,
    parameters: Type.Object({
      message: Type.String({
        description:
          "The task or question to hand off. Write it as a complete instruction — the subagent does not see this conversation.",
      }),
      workspaceId: Type.String({
        description:
          "The workspace ID to run this subagent in. Obtain this from gtSession (preferred), or by calling list-subagent-workspaces / create-subagent-workspace first.",
      }),
      workspaceName: Type.Optional(
        Type.String({
          description:
            "Human-readable workspace name. Optional but recommended — it is stored in gtSession so future turns can show the user a friendly label.",
        }),
      ),
      context: Type.Optional(
        Type.String({
          description:
            "Optional extra context (data, prior findings, constraints). Cross-subagent artifact handoff is automated — you do NOT need to enumerate sibling workspaces here; the tool reads gtSession and prepends them itself.",
        }),
      ),
    }),
    execute: async (_toolCallId, params) => {
      const message = String(params?.message || "");
      const workspaceId = String(params?.workspaceId || "");
      const workspaceName = params?.workspaceName
        ? String(params.workspaceName)
        : undefined;
      const userContext = params?.context ? String(params.context) : "";

      if (!workspaceId) {
        return toolError(
          "workspaceId is required. Use gtSession (read with workspace_read) or call list-subagent-workspaces / create-subagent-workspace first.",
        );
      }
      if (!message) return toolError("message is required");

      // Auto-inject upstream artifacts so the called subagent sees what
      // sibling workspaces it can pull from. Only the GT (main-assistant)
      // has a populated gtSession; for other callers this no-ops cleanly.
      const session = await readGtSession();
      const upstream = buildUpstreamBlock(session, meta.subagentId);
      const contextParts = [upstream, userContext].filter(
        (s): s is string => !!s && s.trim().length > 0,
      );
      const context = contextParts.length ? contextParts.join("\n\n") : undefined;

      const { orgId } = getOrgUser();
      const payload: Record<string, unknown> = {
        subagentId: meta.subagentId,
        message,
        orgId,
        workspaceId,
      };
      if (context) payload.context = context;

      const result = await internalPost("/assistant/subagent-run", payload);

      // Record the invocation in the GT session unless the subagent
      // itself reported an error envelope.
      if (!isApiError(result)) {
        const answer =
          typeof (result as { answer?: unknown }).answer === "string"
            ? String((result as { answer: string }).answer)
            : typeof (result as { question?: unknown }).question === "string"
              ? String((result as { question: string }).question)
              : "";
        await recordInvocation({
          subagentId: meta.subagentId,
          workspaceId,
          workspaceName,
          lastTask: message,
          lastAnswer: answer,
        });
      }

      return toolText(result, {
        subagentId: meta.subagentId,
        workspaceId,
        upstreamCount: upstream
          ? upstream.split("\n").filter((l) => l.startsWith("- ")).length
          : 0,
      });
    },
  });
}
