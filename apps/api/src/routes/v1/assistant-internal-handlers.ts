import { httpError } from "../http-error.js";
import { getOrStartInstance } from '../../lib/instance-manager';
import { getAssistantConfig } from '../../lib/assistant-store';
import { composeSystemPrompt } from '../../lib/assistant-prompt';
import {
  createWorkspaceRecord,
  insertWorkspaceMessage,
  listWorkspacesBySpecialist,
} from '../../lib/local-sqlite.js';
import { listMemories, upsertMemory } from '../../lib/memory-store';
import {
  buildSpecialistInstanceId,
  buildAgentConfig,
  resolveDefaultRunner,
  canonicalAgentKind,
} from '../../lib/agent-spawn.js';
import { buildProjectHub } from '../../lib/project-hub.js';
import { executeChatTurnAndWait } from '../../lib/instances/chat-turn-orchestrator.js';
import { buildDefaultWorkspaceConfigurations } from '../../lib/workspace-tool-host-sync.js';

/**
 * GET /v1/internal/assistant/specialist-workspaces?specialistId=...
 */
export async function listWorkspaces(specialistId?: string) {
  if (!specialistId) {
    throw httpError("specialistId is required", 400);
  }

  const workspaces = listWorkspacesBySpecialist(specialistId);
  return {
    workspaces: workspaces.map((row) => ({
      id: row.id,
      name: row.name,
      date: row.date,
    })),
  };
}

/**
 * POST /v1/internal/assistant/specialist-workspaces
 */
export async function createWorkspace(body: Record<string, unknown>) {
  const { specialistId, name } = body || ({} as typeof body);
  if (!specialistId || !name) {
    throw httpError('specialistId and name are required', 400);
  }

  const workspaceId = crypto.randomUUID();
  const configurations = buildDefaultWorkspaceConfigurations(
    String(specialistId),
    workspaceId,
  );

  const workspace = createWorkspaceRecord({
    id: workspaceId,
    specialistId: String(specialistId),
    name: String(name),
    configurations,
  });

  console.log(
    `[specialist-workspaces] Created workspace "${name}" (${workspace.id}) for ${specialistId}`,
  );

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      date: workspace.date,
    },
  };
}

export async function getProjectHub(body: Record<string, unknown> = {}) {
  const gtWorkspaceId =
    typeof body.gtWorkspaceId === "string" && body.gtWorkspaceId.trim()
      ? body.gtWorkspaceId.trim()
      : typeof body.workspaceId === "string" && body.workspaceId.trim()
        ? body.workspaceId.trim()
        : "";

  if (!gtWorkspaceId) {
    throw httpError("gtWorkspaceId is required", 400);
  }

  return buildProjectHub(gtWorkspaceId);
}

export async function getMemories() {
  const memories = await listMemories();
  return { memories };
}

export async function saveMemory(body: Record<string, unknown>) {
  const { title, content } = body || ({} as typeof body);
  if (!title || !content) {
    throw httpError('title and content are required', 400);
  }
  const memory = await upsertMemory({
    id: typeof body.id === 'string' ? body.id : undefined,
    title: String(title),
    content: String(content),
    applies_to: Array.isArray(body.applies_to) ? body.applies_to : [],
    tags: Array.isArray(body.tags) ? body.tags : [],
  });
  return memory;
}

export async function runSpecialist(body: Record<string, unknown>) {
  const { specialistId, message } = body || ({} as typeof body);
  if (!specialistId || !message) {
    throw httpError('specialistId and message are required', 400);
  }

  const config = await getAssistantConfig();
  const gatewayKind = canonicalAgentKind(String(specialistId));
  const systemPrompt = await composeSystemPrompt({
    config,
    query: String(message),
    userId: null,
    specialist: gatewayKind,
  });

  const scopeId = body.workspaceId
    ? String(body.workspaceId)
    : `ephemeral:${gatewayKind}`;
  const workspaceKey = buildSpecialistInstanceId(gatewayKind, scopeId);

  const agentConfig = buildAgentConfig({
    agentKind: gatewayKind,
    systemPrompt,
    runner: resolveDefaultRunner(),
    provider: {
      kind: (config.provider as 'openrouter' | 'openai' | 'groq' | 'ollama') || 'openrouter',
      model: config.model || 'minimax/minimax-m2.7',
    },
  });

  await getOrStartInstance(
    workspaceKey,
    gatewayKind,
    agentConfig,
  );

  const composedMessage = body.context
    ? `${message}\n\n---\nContext from main assistant:\n${body.context}`
    : String(message);

  try {
    const turn = await executeChatTurnAndWait(workspaceKey, {
      message: composedMessage,
    });

    const answer =
      turn.result.response.answer || turn.result.response.question || '';

    if (body.workspaceId) {
      try {
        insertWorkspaceMessage({
          workspaceId: String(body.workspaceId),
          role: 'user',
          content: composedMessage,
        });
        insertWorkspaceMessage({
          workspaceId: String(body.workspaceId),
          role: 'assistant',
          content: answer,
        });
      } catch (err) {
        console.error(`[specialist-run] Failed to persist workspace messages:`, err);
      }
    }

    return {
      specialistId,
      type: turn.result.response.type,
      answer: turn.result.response.answer,
      question: turn.result.response.question,
      ...(body.workspaceId ? { workspaceId: body.workspaceId } : {}),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw httpError(msg, 500);
  }
}
