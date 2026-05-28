"use client";

import { Braces, Trash2 } from "lucide-react";
import type { LocalSkillConfig } from "../../preferences";
import type { LlmProviderKind } from "@dude/sdk/runner";
import type { DudePreferences } from "../../preferences";
import { usePreferenceUpdaters } from "./use-preference-updaters";
import {
  createLocalConfigId,
  newMcpServer,
  newSkill,
  newSourceTool,
  splitArgs,
} from "./preference-config-helpers";

export function PreferencesAppConfigSection({
  preferences,
  onChange,
}: {
  preferences: DudePreferences;
  onChange: (preferences: DudePreferences) => void;
}) {
  const {
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
  } = usePreferenceUpdaters(preferences, onChange);

  return (
            <>
              <h2 className="mb-3 text-3xl font-semibold tracking-normal text-[var(--dude-text)]">
                App Configurations
              </h2>
              <p className="mb-8 max-w-2xl text-sm leading-relaxed text-[var(--dude-muted)]">
                MCP servers, source tools, and skills configured here are
                available to the local agent runtime across the app.
              </p>
              <div className="max-w-4xl space-y-8">
                <section className="space-y-3 rounded-lg px-2 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium tracking-normal text-[var(--dude-text)]">
                        MCP servers
                      </h3>
                      <p className="mt-1 text-xs text-[var(--dude-muted)]">
                        Add local or remote MCP endpoints the runtime can expose
                        to agents.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateAppConfigurations({
                          mcpServers: [
                            ...preferences.appConfigurations.mcpServers,
                            newMcpServer(),
                          ],
                        })
                      }
                      className="rounded-md bg-[var(--dude-surface-2)] px-3 py-1.5 text-sm text-[var(--dude-text)] transition-colors hover:bg-[var(--dude-line)]"
                    >
                      Add server
                    </button>
                  </div>

                  {preferences.appConfigurations.mcpServers.length === 0 ? (
                    <div className="px-2 py-6 text-sm text-[var(--dude-muted)]">
                      No MCP servers configured.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {preferences.appConfigurations.mcpServers.map((server, index) => {
                        const envEntries = Object.entries(server.env ?? {});
                        return (
                          <div
                            key={server.id}
                            className="space-y-3 py-6"
                          >
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                              <label className="flex items-center gap-2 text-sm text-[var(--dude-text)]">
                                <input
                                  type="checkbox"
                                  checked={server.enabled}
                                  onChange={(event) =>
                                    updateMcpServer(server.id, {
                                      enabled: event.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 accent-[var(--dude-accent)]"
                                />
                                Enabled
                              </label>
                              <button
                                type="button"
                                onClick={() => removeMcpServer(server.id)}
                                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--dude-muted)] transition-colors hover:bg-[var(--dude-surface-2)] hover:text-[var(--dude-danger)]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remove
                              </button>
                            </div>

                            <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                              <label className="space-y-1.5">
                                <span className="text-xs font-medium text-[var(--dude-muted)]">
                                  Name
                                </span>
                                <input
                                  value={server.name}
                                  onChange={(event) =>
                                    updateMcpServer(server.id, {
                                      name: event.target.value,
                                    })
                                  }
                                  placeholder={`Server ${index + 1}`}
                                  className="h-9 w-full rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 text-sm text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                                />
                              </label>
                              <label className="space-y-1.5">
                                <span className="text-xs font-medium text-[var(--dude-muted)]">
                                  Transport
                                </span>
                                <select
                                  value={server.transport}
                                  onChange={(event) =>
                                    updateMcpServer(server.id, {
                                      transport: event.target.value as LocalMcpServerConfig["transport"],
                                    })
                                  }
                                  className="h-9 w-full rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 text-sm text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                                >
                                  <option value="http">HTTP</option>
                                  <option value="sse">SSE</option>
                                  <option value="stdio">stdio</option>
                                </select>
                              </label>
                            </div>

                            {server.transport === "stdio" ? (
                              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
                                <label className="space-y-1.5">
                                  <span className="text-xs font-medium text-[var(--dude-muted)]">
                                    Command
                                  </span>
                                  <input
                                    value={server.command ?? ""}
                                    onChange={(event) =>
                                      updateMcpServer(server.id, {
                                        command: event.target.value,
                                      })
                                    }
                                    placeholder="npx"
                                    className="h-9 w-full rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 text-sm text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                                  />
                                </label>
                                <label className="space-y-1.5">
                                  <span className="text-xs font-medium text-[var(--dude-muted)]">
                                    Arguments
                                  </span>
                                  <input
                                    value={(server.args ?? []).join(" ")}
                                    onChange={(event) =>
                                      updateMcpServer(server.id, {
                                        args: splitArgs(event.target.value),
                                      })
                                    }
                                    placeholder="-y @modelcontextprotocol/server-filesystem"
                                    className="h-9 w-full rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 text-sm text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                                  />
                                </label>
                              </div>
                            ) : (
                              <label className="mt-3 block space-y-1.5">
                                <span className="text-xs font-medium text-[var(--dude-muted)]">
                                  URL
                                </span>
                                <input
                                  value={server.url ?? ""}
                                  onChange={(event) =>
                                    updateMcpServer(server.id, {
                                      url: event.target.value,
                                    })
                                  }
                                  placeholder="https://example.com/mcp"
                                  className="h-9 w-full rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 text-sm text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                                />
                              </label>
                            )}

                            <div className="mt-4 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-medium text-[var(--dude-muted)]">
                                  Environment variables
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateMcpEnv(
                                      server.id,
                                      "",
                                      `KEY_${envEntries.length + 1}`,
                                      "",
                                    )
                                  }
                                  className="rounded-md px-2 py-1 text-xs text-[var(--dude-muted)] transition-colors hover:bg-[var(--dude-surface-2)] hover:text-[var(--dude-text)]"
                                >
                                  Add variable
                                </button>
                              </div>
                              {envEntries.length === 0 ? (
                                <p className="text-xs text-[var(--dude-muted)]">
                                  No environment variables.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {envEntries.map(([key, value]) => (
                                    <div
                                      key={key}
                                      className="grid gap-2 md:grid-cols-[180px_1fr_auto]"
                                    >
                                      <input
                                        value={key}
                                        onChange={(event) =>
                                          updateMcpEnv(
                                            server.id,
                                            key,
                                            event.target.value,
                                            value,
                                          )
                                        }
                                        placeholder="KEY"
                                        className="h-9 rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 font-mono text-xs text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                                      />
                                      <input
                                        value={value}
                                        onChange={(event) =>
                                          updateMcpEnv(
                                            server.id,
                                            key,
                                            key,
                                            event.target.value,
                                          )
                                        }
                                        placeholder="value"
                                        type="password"
                                        className="h-9 rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 font-mono text-xs text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeMcpEnv(server.id, key)}
                                        className="h-9 rounded-md px-2 text-xs text-[var(--dude-muted)] transition-colors hover:bg-[var(--dude-surface-2)] hover:text-[var(--dude-danger)]"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="space-y-3 rounded-lg px-2 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium tracking-normal text-[var(--dude-text)]">
                        Skills
                      </h3>
                      <p className="mt-1 text-xs text-[var(--dude-muted)]">
                        Add reusable agent skills, define how they are found,
                        and configure their runtime variables.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateAppConfigurations({
                          skills: [
                            ...preferences.appConfigurations.skills,
                            newSkill(),
                          ],
                        })
                      }
                      className="rounded-md bg-[var(--dude-surface-2)] px-3 py-1.5 text-sm text-[var(--dude-text)] transition-colors hover:bg-[var(--dude-line)]"
                    >
                      Add skill
                    </button>
                  </div>

                  {preferences.appConfigurations.skills.length === 0 ? (
                    <div className="px-2 py-6 text-sm text-[var(--dude-muted)]">
                      No skills configured.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {preferences.appConfigurations.skills.map((skill, index) => {
                        const configEntries = Object.entries(skill.config ?? {});
                        return (
                          <div
                            key={skill.id}
                            className="space-y-3 py-6"
                          >
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                              <label className="flex items-center gap-2 text-sm text-[var(--dude-text)]">
                                <input
                                  type="checkbox"
                                  checked={skill.enabled}
                                  onChange={(event) =>
                                    updateSkill(skill.id, {
                                      enabled: event.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 accent-[var(--dude-accent)]"
                                />
                                Enabled
                              </label>
                              <button
                                type="button"
                                onClick={() => removeSkill(skill.id)}
                                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--dude-muted)] transition-colors hover:bg-[var(--dude-surface-2)] hover:text-[var(--dude-danger)]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remove
                              </button>
                            </div>

                            <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                              <label className="space-y-1.5">
                                <span className="text-xs font-medium text-[var(--dude-muted)]">
                                  Name
                                </span>
                                <input
                                  value={skill.name}
                                  onChange={(event) =>
                                    updateSkill(skill.id, {
                                      name: event.target.value,
                                    })
                                  }
                                  placeholder={`Skill ${index + 1}`}
                                  className="h-9 w-full rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 text-sm text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                                />
                              </label>
                              <label className="space-y-1.5">
                                <span className="text-xs font-medium text-[var(--dude-muted)]">
                                  Source
                                </span>
                                <select
                                  value={skill.source}
                                  onChange={(event) =>
                                    updateSkill(skill.id, {
                                      source: event.target.value as LocalSkillConfig["source"],
                                    })
                                  }
                                  className="h-9 w-full rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 text-sm text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                                >
                                  <option value="registry">Registry</option>
                                  <option value="local">Local folder</option>
                                  <option value="github">GitHub repo</option>
                                  <option value="inline">Inline</option>
                                </select>
                              </label>
                            </div>

                            <label className="mt-3 block space-y-1.5">
                              <span className="text-xs font-medium text-[var(--dude-muted)]">
                                Reference
                              </span>
                              <input
                                value={skill.reference ?? ""}
                                onChange={(event) =>
                                  updateSkill(skill.id, {
                                    reference: event.target.value,
                                  })
                                }
                                placeholder={
                                  skill.source === "github"
                                    ? "owner/repo/path-or-skill-name"
                                    : skill.source === "local"
                                      ? "/path/to/skill"
                                      : skill.source === "registry"
                                        ? "skill-name"
                                        : "inline-skill-id"
                                }
                                className="h-9 w-full rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 text-sm text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                              />
                            </label>

                            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
                              <label className="space-y-1.5">
                                <span className="text-xs font-medium text-[var(--dude-muted)]">
                                  Trigger
                                </span>
                                <input
                                  value={skill.trigger ?? ""}
                                  onChange={(event) =>
                                    updateSkill(skill.id, {
                                      trigger: event.target.value,
                                    })
                                  }
                                  placeholder="When this skill should be used"
                                  className="h-9 w-full rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 text-sm text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                                />
                              </label>
                              <label className="space-y-1.5">
                                <span className="text-xs font-medium text-[var(--dude-muted)]">
                                  Description
                                </span>
                                <input
                                  value={skill.description}
                                  onChange={(event) =>
                                    updateSkill(skill.id, {
                                      description: event.target.value,
                                    })
                                  }
                                  placeholder="What the skill helps with"
                                  className="h-9 w-full rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 text-sm text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                                />
                              </label>
                            </div>

                            <label className="mt-3 block space-y-1.5">
                              <span className="text-xs font-medium text-[var(--dude-muted)]">
                                Instructions
                              </span>
                              <textarea
                                value={skill.instructions ?? ""}
                                onChange={(event) =>
                                  updateSkill(skill.id, {
                                    instructions: event.target.value,
                                  })
                                }
                                rows={4}
                                placeholder="Optional operating instructions, constraints, or configuration notes."
                                className="w-full resize-y rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 py-2 text-sm text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                              />
                            </label>

                            <div className="mt-4 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-medium text-[var(--dude-muted)]">
                                  Skill configuration
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSkillConfig(
                                      skill.id,
                                      "",
                                      `setting_${configEntries.length + 1}`,
                                      "",
                                    )
                                  }
                                  className="rounded-md px-2 py-1 text-xs text-[var(--dude-muted)] transition-colors hover:bg-[var(--dude-surface-2)] hover:text-[var(--dude-text)]"
                                >
                                  Add setting
                                </button>
                              </div>
                              {configEntries.length === 0 ? (
                                <p className="text-xs text-[var(--dude-muted)]">
                                  No skill-specific settings.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {configEntries.map(([key, value]) => (
                                    <div
                                      key={key}
                                      className="grid gap-2 md:grid-cols-[180px_1fr_auto]"
                                    >
                                      <input
                                        value={key}
                                        onChange={(event) =>
                                          updateSkillConfig(
                                            skill.id,
                                            key,
                                            event.target.value,
                                            value,
                                          )
                                        }
                                        placeholder="setting"
                                        className="h-9 rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 font-mono text-xs text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                                      />
                                      <input
                                        value={value}
                                        onChange={(event) =>
                                          updateSkillConfig(
                                            skill.id,
                                            key,
                                            key,
                                            event.target.value,
                                          )
                                        }
                                        placeholder="value"
                                        className="h-9 rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 font-mono text-xs text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeSkillConfig(skill.id, key)}
                                        className="h-9 rounded-md px-2 text-xs text-[var(--dude-muted)] transition-colors hover:bg-[var(--dude-surface-2)] hover:text-[var(--dude-danger)]"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="space-y-3 rounded-lg px-2 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium tracking-normal text-[var(--dude-text)]">
                        Source tools
                      </h3>
                      <p className="mt-1 text-xs text-[var(--dude-muted)]">
                        Register HTTP/source tools the local runtime can expose
                        beside MCP capabilities.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateAppConfigurations({
                          sourceTools: [
                            ...preferences.appConfigurations.sourceTools,
                            newSourceTool(),
                          ],
                        })
                      }
                      className="rounded-md bg-[var(--dude-surface-2)] px-3 py-1.5 text-sm text-[var(--dude-text)] transition-colors hover:bg-[var(--dude-line)]"
                    >
                      Add tool
                    </button>
                  </div>

                  {preferences.appConfigurations.sourceTools.length === 0 ? (
                    <div className="px-2 py-6 text-sm text-[var(--dude-muted)]">
                      No source tools configured.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {preferences.appConfigurations.sourceTools.map((tool, index) => (
                        <div
                          key={tool.id}
                          className="space-y-3 py-6"
                        >
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <label className="flex items-center gap-2 text-sm text-[var(--dude-text)]">
                              <input
                                type="checkbox"
                                checked={tool.enabled}
                                onChange={(event) =>
                                  updateSourceTool(tool.id, {
                                    enabled: event.target.checked,
                                  })
                                }
                                className="h-4 w-4 accent-[var(--dude-accent)]"
                              />
                              Enabled
                            </label>
                            <button
                              type="button"
                              onClick={() => removeSourceTool(tool.id)}
                              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--dude-muted)] transition-colors hover:bg-[var(--dude-surface-2)] hover:text-[var(--dude-danger)]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          </div>

                          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                            <label className="space-y-1.5">
                              <span className="text-xs font-medium text-[var(--dude-muted)]">
                                Name
                              </span>
                              <input
                                value={tool.name}
                                onChange={(event) =>
                                  updateSourceTool(tool.id, {
                                    name: event.target.value,
                                  })
                                }
                                placeholder={`tool_${index + 1}`}
                                className="h-9 w-full rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 text-sm text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                              />
                            </label>
                            <label className="space-y-1.5">
                              <span className="text-xs font-medium text-[var(--dude-muted)]">
                                Endpoint
                              </span>
                              <input
                                value={tool.endpoint ?? ""}
                                onChange={(event) =>
                                  updateSourceTool(tool.id, {
                                    endpoint: event.target.value,
                                  })
                                }
                                placeholder="https://api.example.com/tool"
                                className="h-9 w-full rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 text-sm text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                              />
                            </label>
                          </div>

                          <label className="mt-3 block space-y-1.5">
                            <span className="text-xs font-medium text-[var(--dude-muted)]">
                              Description
                            </span>
                            <textarea
                              value={tool.description}
                              onChange={(event) =>
                                updateSourceTool(tool.id, {
                                  description: event.target.value,
                                })
                              }
                              rows={3}
                              placeholder="What this tool does and when the agent should use it."
                              className="w-full resize-y rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-3 py-2 text-sm text-[var(--dude-text)] outline-none focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
  );
}
