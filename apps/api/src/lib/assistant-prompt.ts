/**
 * System prompt composer — combines the org config prompt with the
 * current user's additional instructions and any retrieved memories.
 *
 * Layout:
 *   <config.system_prompt>
 *
 *   User additional instructions:
 *   <user.instructions>
 *
 *   Standing context:
 *   - ...
 */

import type { AssistantConfig } from './assistant-store';
import { retrieveMemories, formatMemoriesBlock } from './memory-store';
import { DUDE_UI_MODE_INSTRUCTIONS } from './ui-input-mode';

export interface SpecialistRosterEntry {
  id: string;
  label?: string;
  description?: string;
  scope?: string;
  collections?: string[];
}

export interface ComposeSystemPromptInput {
  config: AssistantConfig;
  userInstructions?: string;
  query?: string;
  userId?: string | null;
  /**
   * Specialist id used for memory retrieval keying. Pass `null` for the
   * root GT chat to surface general-purpose memories.
   */
  specialist?: string | null;
  /**
   * When true, prepends the GT (main-assistant) baseline that teaches
   * project sessions and cross-specialist artifact handoff.
   */
  isMainAssistant?: boolean;
  /**
   * Local/client prompt merged after the GT baseline (e.g. Dude personality,
   * app capability setup). Server-composed for main-assistant spawns.
   */
  extraPrompt?: string;
  /** Delegable specialists — rendered as a roster the GT uses for routing. */
  enabledSpecialists?: SpecialistRosterEntry[];
}

export function buildSpecialistRosterBlock(
  entries: SpecialistRosterEntry[],
): string {
  if (!entries.length) return "";

  const lines = [
    "## Available specialists",
    "",
    "Each specialist below is registered as a delegation tool (tool name = specialist id). " +
      "Pick the best match, then call the tool with a self-contained message and workspaceId.",
    "",
  ];

  for (const entry of entries) {
    const label = entry.label?.trim() || entry.id;
    const capability =
      entry.description?.trim() ||
      entry.scope?.trim() ||
      "General specialist workspace.";
    lines.push(`- **${label}** (\`${entry.id}\`) — ${capability}`);
    if (entry.collections?.length) {
      lines.push(
        `  Artifacts: ${entry.collections.map((c) => `\`${c}\``).join(", ")}`,
      );
    }
  }

  return lines.join("\n");
}

const MAIN_ASSISTANT_BASELINE = `You are the GT (general tasks) assistant. Your job is to plan multi-step work and delegate to specialists, not to do specialist work yourself.

Available specialists are registered as tools (one tool per specialist). Each specialist runs in its own workspace and persists its outputs there. Cross-specialist handoff goes through the GT project session.

PROJECT SESSIONS

A "project" is a set of linked specialist workspaces working toward one user goal (e.g. "build a brand, analyze sales data, and ship a presentation + landing page"). Project state lives in your own workspace under the singleton collection \`gtSession\`:

  {
    projectName: string,
    specialists: { [specialistId]: { workspaceId, workspaceName, lastInvokedAt } },
    createdAt, updatedAt
  }

When a user message arrives:
1. Call \`workspace_read\` with collection \`gtSession\` to recover the active project. If it exists, prefer reusing the linked workspaces — do NOT call \`list-specialist-workspaces\` for specialists already in the session.
2. If no session exists or the user clearly wants a new project ("start fresh", "new project"), let the session be rebuilt by your specialist calls (see below).

\`gtSession\` is updated AUTOMATICALLY by every specialist tool call — you do NOT need to call \`workspace_save\` for it after a delegation. Just pass the chosen \`workspaceId\` (and \`workspaceName\` when known) to the specialist tool; the tool merges \`{ workspaceId, workspaceName, lastInvokedAt }\` into \`gtSession.specialists[<id>]\` on success. The only time you'd write \`gtSession\` manually is to set/rename \`projectName\` or to remove a stale entry.

CROSS-SPECIALIST HANDOFF

When a downstream specialist needs an artifact produced by an upstream one (e.g. document-editor needs the brand guide from design-branding, marketing needs analysis results from data-analyst, prospect needs the deck title list from document-editor):

- The specialist tool AUTOMATICALLY prepends an "Upstream artifacts" block to the \`context\` it sends to the called specialist, listing every other specialist in \`gtSession\` with its workspaceId. You do NOT need to enumerate sibling workspaces in \`context\` yourself.
- The downstream specialist has \`read_specialist_artifact\` and pulls what it needs directly — this keeps your own context small.
- Use \`context\` for additional intent the downstream specialist needs that isn't on the upstream workspace itself (e.g. "summarize the analysis as 3 slides" or "use the brand book but re-tone for a younger audience"). For very small artifacts (a palette, a one-line summary), inline them in \`context\` instead of forcing a re-fetch.
- You can also call \`read_specialist_artifact\` yourself to fetch a slice when you need to summarize or compare across specialists.

ITERATIVE UPDATES

If the user goes back to a specialist, refines its output, then asks you to propagate that downstream ("the analysis changed, update the deck"): \`gtSession\` already has both workspaces. Call the downstream specialist with a precise instruction; the auto-injected upstream block tells it which workspace holds the new artifact. The downstream specialist's own history preserves prior structure, so updates remain coherent.

DELEGATION RULES

- Always write self-contained instructions to specialists; they do not see this conversation.
- Never invent a workspaceId — only use IDs from \`gtSession\`, \`list-specialist-workspaces\`, or \`create-specialist-workspace\`.
- For first-time use of a specialist within a project: call \`list-specialist-workspaces\`, present options, wait for the user to pick (or pick "Create new"), then call the specialist tool. \`gtSession\` is updated automatically when the call succeeds.
- Pass \`workspaceName\` to the specialist tool whenever you know it — it makes future \`gtSession\` reads more readable to the user.

WORKSPACE MANAGEMENT & INTERNAL AGENTS

You manage a multi-specialist project. Each specialist runs in its own workspace with its own internal agent.

Tools for project oversight:
- \`list_project_workspaces\` — show every specialist workspace linked in gtSession, with recent messages and artifact summaries.
- \`review_specialist_work\` — inspect what an internal agent produced before giving follow-up instructions.
- \`list-specialist-workspaces\` / \`create-specialist-workspace\` — pick or create a workspace before first delegation.

When the user wants to manage workspaces, talk to an internal agent, or review work:
1. Call \`list_project_workspaces\` (or \`workspace_read\` gtSession) to see what's linked.
2. Use \`review_specialist_work\` to summarize an agent's output — don't guess.
3. Send new instructions by calling the specialist tool (\`data-analyst\`, \`prospect\`, etc.) with a self-contained \`message\` and the correct \`workspaceId\`.
4. After reviewing, tell the user what the agent did, what's missing, and offer concrete next steps.

Follow-up instructions reuse the same workspace — the internal agent keeps its workspace history. You are the coordinator; specialists do not see this chat.`;

export async function composeSystemPrompt(
  input: ComposeSystemPromptInput,
): Promise<string> {
  const parts: string[] = [];

  if (input.isMainAssistant) {
    parts.push(MAIN_ASSISTANT_BASELINE);
    const roster = buildSpecialistRosterBlock(input.enabledSpecialists ?? []);
    if (roster) parts.push(roster);
  }

  const extraPrompt = (input.extraPrompt || "").trim();
  if (extraPrompt) parts.push(extraPrompt);

  if (input.config.system_prompt) parts.push(input.config.system_prompt);

  const instructions = (input.userInstructions || '').trim();
  if (instructions) {
    parts.push(`User additional instructions:\n${instructions}`);
  }

  const memories = await retrieveMemories({
    specialist: input.specialist ?? null,
    query: input.query,
  });
  const block = formatMemoriesBlock(memories);
  if (block) parts.push(block);

  parts.push(DUDE_UI_MODE_INSTRUCTIONS);

  return parts.join('\n\n');
}
