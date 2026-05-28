import type {
  LocalChatRuntime,
  LocalSpecialistWorkspace,
  LocalStoredFile,
  SpecialistId,
} from "./types";
import {
  clearGatewaySessionId,
  GATEWAY_USER_ID,
  readGatewaySessionId,
  writeGatewaySessionId,
} from "@dude/chat/lib/gateway-session";
import { bindWorkspaceChatRuntime } from "@dude/workspaces/runtime-binding";
import { bindWorkspaceConfigHydrator } from "@dude/workspaces/config-hydrator-binding";
import { hydrateWorkspaceConfigurationsFromGateway } from "./runtime/gateway-workspace-config";
import {
  appendMessagePair,
  createSuggestions,
  fetchProjectHubSnapshot,
  canUseGateway,
  isDesktopApp,
  respondGatewayUiInput,
  sendGatewayMessage,
  syncGatewayMessagesToLocalThread,
  resumeGatewayTurnIfNeeded,
  abandonGatewayTurn,
} from "./runtime/local-chat-gateway";
import { normalizeChatScopeId } from "./runtime/chat-scope";
import {
  createAssistantReply,
  createId,
  defaultWorkspaceConfig,
  defaultWorkspaceName,
  getThread,
  readState,
  threadKey,
  workspaceSort,
  writeState,
} from "./runtime/local-chat-storage";

export { SPECIALISTS, getSpecialistRegistry } from "./runtime/specialist-list";

export const browserChatRuntime: LocalChatRuntime = {
  async listWorkspaces(specialistId) {
    const state = await readState();
    return Object.values(state.workspaces)
      .filter((workspace) => workspace.specialistId === specialistId)
      .sort(workspaceSort);
  },

  async getWorkspace(workspaceId) {
    const state = await readState();
    return state.workspaces[workspaceId] ?? null;
  },

  async createWorkspace(input) {
    const state = await readState();
    const now = new Date().toISOString();
    const workspace: LocalSpecialistWorkspace = {
      id: createId(`ws-${input.specialistId}`),
      specialistId: input.specialistId,
      name: input.name?.trim() || defaultWorkspaceName(input.specialistId),
      createdAt: now,
      updatedAt: now,
      status: "draft",
      configurations: {
        ...defaultWorkspaceConfig(input.specialistId),
        ...(input.configurations ?? {}),
      },
    };
    state.workspaces[workspace.id] = workspace;
    await writeState(state);
    return workspace;
  },

  async updateWorkspace(workspaceId, updates) {
    const state = await readState();
    const workspace = state.workspaces[workspaceId];
    if (!workspace) return null;

    const nextWorkspace: LocalSpecialistWorkspace = {
      ...workspace,
      ...updates,
      configurations: {
        ...workspace.configurations,
        ...(updates.configurations ?? {}),
      },
      updatedAt: new Date().toISOString(),
    };
    state.workspaces[workspaceId] = nextWorkspace;
    await writeState(state);
    return nextWorkspace;
  },

  async deleteWorkspace(workspaceId) {
    const state = await readState();
    if (!state.workspaces[workspaceId]) return false;
    delete state.workspaces[workspaceId];
    for (const key of Object.keys(state.threads)) {
      if (key.includes(`:${workspaceId}`)) {
        delete state.threads[key];
      }
    }
    await writeState(state);
    return true;
  },

  async listMessages(specialistId, workspaceId) {
    if (
      canUseGateway() &&
      normalizeChatScopeId(specialistId, workspaceId)
    ) {
      const synced = await syncGatewayMessagesToLocalThread(
        specialistId,
        workspaceId,
      );
      return synced.messages;
    }
    const state = await readState();
    const messages = getThread(state, specialistId, workspaceId);
    await writeState(state);
    return messages;
  },

  async resumeActiveTurn(specialistId, workspaceId) {
    if (!canUseGateway()) {
      return { active: false as const };
    }
    return resumeGatewayTurnIfNeeded(specialistId, workspaceId);
  },

  abandonActiveTurn(specialistId, workspaceId) {
    if (!canUseGateway()) return;
    abandonGatewayTurn(specialistId, workspaceId);
  },

  async respondUiInput(workspaceId, requestId, response) {
    if (!canUseGateway()) {
      throw new Error("UI input responses require the local gateway.");
    }
    await respondGatewayUiInput(workspaceId, requestId, response);
  },

  async sendMessage(input) {
    if (canUseGateway()) {
      const result = await sendGatewayMessage(input);
      const saved = await appendMessagePair(
        input,
        result.userMessage,
        result.assistantMessage,
      );
      return { ...saved, gatewaySessionId: result.gatewaySessionId };
    }
    if (isDesktopApp()) {
      throw new Error(
        "The local gateway is not running. Start the gateway from Dude settings, then try again.",
      );
    }

    const state = await readState();
    const messages = getThread(state, input.specialistId, input.workspaceId);
    const now = new Date().toISOString();
    const userMessage = {
      id: createId("msg"),
      role: "user" as const,
      specialistId: input.specialistId,
      createdAt: now,
      content: input.content,
      images: input.images,
      files: input.files,
    };
    const assistantMessage = {
      id: createId("msg"),
      role: "assistant" as const,
      specialistId: input.specialistId,
      createdAt: new Date(Date.now() + 250).toISOString(),
      content: createAssistantReply(input),
      suggestions: createSuggestions(input),
    };

    messages.push(userMessage, assistantMessage);
    await writeState(state);

    return { userMessage, assistantMessage };
  },

  async clearThread(specialistId, workspaceId) {
    clearGatewaySessionId(specialistId, workspaceId);
    const state = await readState();
    state.threads[threadKey(specialistId, workspaceId)] = [];
    const messages = getThread(state, specialistId, workspaceId);
    await writeState(state);
    return messages;
  },

  async saveFile(file) {
    const state = await readState();
    const now = new Date().toISOString();
    const saved: LocalStoredFile = {
      ...file,
      createdAt: file.createdAt ?? now,
      updatedAt: file.updatedAt ?? now,
    };
    state.files[saved.id] = saved;
    await writeState(state);
    return saved;
  },

  async getFile(fileId) {
    const state = await readState();
    return state.files[fileId] ?? null;
  },

  async deleteFile(fileId) {
    const state = await readState();
    if (!state.files[fileId]) return false;
    delete state.files[fileId];
    await writeState(state);
    return true;
  },

  async fetchProjectHub(specialistId, workspaceId) {
    return fetchProjectHubSnapshot(specialistId, workspaceId);
  },
};

bindWorkspaceChatRuntime(browserChatRuntime);
bindWorkspaceConfigHydrator(hydrateWorkspaceConfigurationsFromGateway);

export {
  clearGatewaySessionId,
  GATEWAY_USER_ID,
  readGatewaySessionId,
  writeGatewaySessionId,
} from "@dude/chat/lib/gateway-session";
