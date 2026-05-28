import type {
  DudeAppConfigurations,
  DudePreferences,
  DudeRuntimeCredentials,
  DudeRuntimeSettings,
  LocalMcpServerConfig,
  LocalSkillConfig,
  LocalSourceToolConfig,
} from "../../preferences";

export function usePreferenceUpdaters(
  preferences: DudePreferences,
  onChange: (preferences: DudePreferences) => void,
) {
  function updatePreference(updates: Partial<DudePreferences>) {
    onChange({
      ...preferences,
      ...updates,
      assistantName:
        updates.assistantName !== undefined
          ? updates.assistantName
          : preferences.assistantName,
    });
  }

  function updateRuntime(updates: Partial<DudeRuntimeSettings>) {
    updatePreference({
      runtime: {
        ...preferences.runtime,
        ...updates,
        provider: {
          ...preferences.runtime.provider,
          ...(updates.provider ?? {}),
        },
        credentials: {
          ...preferences.runtime.credentials,
          ...(updates.credentials ?? {}),
        },
      },
    });
  }

  function updateCredential(key: keyof DudeRuntimeCredentials, value: string) {
    updateRuntime({
      credentials: {
        ...preferences.runtime.credentials,
        [key]: value.trim() ? value : undefined,
      },
    });
  }

  function updateAppConfigurations(updates: Partial<DudeAppConfigurations>) {
    updatePreference({
      appConfigurations: {
        ...preferences.appConfigurations,
        ...updates,
      },
    });
  }

  function updateMcpServer(
    id: string,
    updates: Partial<LocalMcpServerConfig>,
  ) {
    updateAppConfigurations({
      mcpServers: preferences.appConfigurations.mcpServers.map((server) =>
        server.id === id ? { ...server, ...updates } : server,
      ),
    });
  }

  function removeMcpServer(id: string) {
    updateAppConfigurations({
      mcpServers: preferences.appConfigurations.mcpServers.filter(
        (server) => server.id !== id,
      ),
    });
  }

  function updateMcpEnv(
    serverId: string,
    previousKey: string,
    nextKey: string,
    nextValue: string,
  ) {
    const server = preferences.appConfigurations.mcpServers.find(
      (item) => item.id === serverId,
    );
    if (!server) return;
    const env = { ...(server.env ?? {}) };
    if (previousKey && previousKey !== nextKey) {
      delete env[previousKey];
    }
    if (nextKey.trim()) {
      env[nextKey.trim()] = nextValue;
    }
    updateMcpServer(serverId, { env });
  }

  function removeMcpEnv(serverId: string, key: string) {
    const server = preferences.appConfigurations.mcpServers.find(
      (item) => item.id === serverId,
    );
    if (!server) return;
    const env = { ...(server.env ?? {}) };
    delete env[key];
    updateMcpServer(serverId, { env });
  }

  function updateSourceTool(
    id: string,
    updates: Partial<LocalSourceToolConfig>,
  ) {
    updateAppConfigurations({
      sourceTools: preferences.appConfigurations.sourceTools.map((tool) =>
        tool.id === id ? { ...tool, ...updates } : tool,
      ),
    });
  }

  function removeSourceTool(id: string) {
    updateAppConfigurations({
      sourceTools: preferences.appConfigurations.sourceTools.filter(
        (tool) => tool.id !== id,
      ),
    });
  }

  function updateSkill(id: string, updates: Partial<LocalSkillConfig>) {
    updateAppConfigurations({
      skills: preferences.appConfigurations.skills.map((skill) =>
        skill.id === id ? { ...skill, ...updates } : skill,
      ),
    });
  }

  function removeSkill(id: string) {
    updateAppConfigurations({
      skills: preferences.appConfigurations.skills.filter(
        (skill) => skill.id !== id,
      ),
    });
  }

  function updateSkillConfig(
    skillId: string,
    previousKey: string,
    nextKey: string,
    nextValue: string,
  ) {
    const skill = preferences.appConfigurations.skills.find(
      (item) => item.id === skillId,
    );
    if (!skill) return;
    const config = { ...(skill.config ?? {}) };
    if (previousKey && previousKey !== nextKey) {
      delete config[previousKey];
    }
    if (nextKey.trim()) {
      config[nextKey.trim()] = nextValue;
    }
    updateSkill(skillId, { config });
  }

  function removeSkillConfig(skillId: string, key: string) {
    const skill = preferences.appConfigurations.skills.find(
      (item) => item.id === skillId,
    );
    if (!skill) return;
    const config = { ...(skill.config ?? {}) };
    delete config[key];
    updateSkill(skillId, { config });
  }
  return {
    updatePreference,
    updateRuntime,
    updateCredential,
    updateAppConfigurations,
    updateMcpServer,
    removeMcpServer,
    updateMcpEnv,
    removeMcpEnv,
    updateSourceTool,
    removeSourceTool,
    updateSkill,
    removeSkill,
    updateSkillConfig,
    removeSkillConfig,
  };
}
