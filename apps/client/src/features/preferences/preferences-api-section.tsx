"use client";

import { Trash2 } from "lucide-react";
import type { LlmProviderKind } from "@dude/sdk/runner";
import type { DudePreferences } from "../../preferences";
import { usePreferenceUpdaters } from "./use-preference-updaters";

export function PreferencesApiSection({
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
                API &amp; Models
              </h2>
              <p className="mb-8 max-w-2xl text-sm leading-relaxed text-[var(--dude-muted)]">
                Bring your own keys. Credentials are stored locally in this app
                and sent to the agent runtime when a workspace starts — no
                .env file required.
              </p>
              <div className="max-w-2xl space-y-2">
                <section className="grid gap-3 rounded-lg px-2 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
                  <div>
                    <h3 className="text-sm font-medium tracking-normal text-[var(--dude-text)]">
                      LLM provider
                    </h3>
                  </div>
                  <select
                    value={preferences.runtime.provider.kind}
                    onChange={(event) => {
                      const kind = event.target.value as LlmProviderKind;
                      updateRuntime({
                        provider: {
                          kind,
                          model:
                            kind === "openrouter"
                              ? "deepseek/deepseek-v4-pro"
                              : kind === "openai" || kind === "openai-codex"
                                ? "gpt-4.1"
                                : kind === "groq"
                                  ? "llama-3.3-70b-versatile"
                                  : "llama3.2",
                        },
                      });
                    }}
                    className="h-9 w-full rounded-md border border-transparent bg-[var(--dude-surface)] px-2 text-sm text-[var(--dude-text)] outline-none transition-colors focus:border-[var(--dude-line)]"
                  >
                    <option value="openrouter">OpenRouter</option>
                    <option value="openai">OpenAI</option>
                    <option value="openai-codex">OpenAI Codex</option>
                    <option value="groq">Groq</option>
                    <option value="ollama">Ollama (local)</option>
                  </select>
                </section>

                <section className="grid gap-3 rounded-lg px-2 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
                  <div>
                    <h3 className="text-sm font-medium tracking-normal text-[var(--dude-text)]">
                      Model
                    </h3>
                  </div>
                  <input
                    value={preferences.runtime.provider.model}
                    onChange={(event) =>
                      updateRuntime({
                        provider: {
                          ...preferences.runtime.provider,
                          model: event.target.value,
                        },
                      })
                    }
                    className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 font-mono text-sm text-[var(--dude-text)] outline-none transition-colors placeholder:text-[var(--dude-muted)] focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                    placeholder="deepseek/deepseek-v4-pro"
                  />
                </section>

                {preferences.runtime.provider.kind === "openrouter" && (
                  <section className="grid gap-3 rounded-lg px-2 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
                    <div>
                      <h3 className="text-sm font-medium tracking-normal text-[var(--dude-text)]">
                        OpenRouter API key
                      </h3>
                    </div>
                    <input
                      type="password"
                      autoComplete="off"
                      value={preferences.runtime.credentials.openrouter ?? ""}
                      onChange={(event) =>
                        updateCredential("openrouter", event.target.value)
                      }
                      className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 font-mono text-sm text-[var(--dude-text)] outline-none transition-colors placeholder:text-[var(--dude-muted)] focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                      placeholder="sk-or-..."
                    />
                  </section>
                )}

                {(preferences.runtime.provider.kind === "openai" ||
                  preferences.runtime.provider.kind === "openai-codex") && (
                  <section className="grid gap-3 rounded-lg px-2 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
                    <div>
                      <h3 className="text-sm font-medium tracking-normal text-[var(--dude-text)]">
                        OpenAI API key
                      </h3>
                    </div>
                    <input
                      type="password"
                      autoComplete="off"
                      value={preferences.runtime.credentials.openai ?? ""}
                      onChange={(event) =>
                        updateCredential("openai", event.target.value)
                      }
                      className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 font-mono text-sm text-[var(--dude-text)] outline-none transition-colors placeholder:text-[var(--dude-muted)] focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                      placeholder="sk-..."
                    />
                  </section>
                )}

                {preferences.runtime.provider.kind === "groq" && (
                  <section className="grid gap-3 rounded-lg px-2 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
                    <div>
                      <h3 className="text-sm font-medium tracking-normal text-[var(--dude-text)]">
                        Groq API key
                      </h3>
                    </div>
                    <input
                      type="password"
                      autoComplete="off"
                      value={preferences.runtime.credentials.groq ?? ""}
                      onChange={(event) =>
                        updateCredential("groq", event.target.value)
                      }
                      className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 font-mono text-sm text-[var(--dude-text)] outline-none transition-colors placeholder:text-[var(--dude-muted)] focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                      placeholder="gsk_..."
                    />
                  </section>
                )}

                <section className="mt-10 space-y-2">
                  <h3 className="mb-1 text-sm font-medium text-[var(--dude-text)]">
                    Integrations
                  </h3>
                  <p className="mb-4 text-xs leading-relaxed text-[var(--dude-muted)]">
                    Optional keys for web search, enrichment, and memory ranking.
                  </p>
                  <div className="space-y-2">
                    <section className="grid gap-3 rounded-lg px-2 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <div>
                        <h4 className="text-sm font-medium text-[var(--dude-text)]">
                          Firecrawl URL
                        </h4>
                      </div>
                      <input
                        value={preferences.runtime.credentials.firecrawlUrl ?? ""}
                        onChange={(event) =>
                          updateCredential("firecrawlUrl", event.target.value)
                        }
                        className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 font-mono text-sm text-[var(--dude-text)] outline-none transition-colors placeholder:text-[var(--dude-muted)] focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                        placeholder="https://api.firecrawl.dev"
                      />
                    </section>

                    <section className="grid gap-3 rounded-lg px-2 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <div>
                        <h4 className="text-sm font-medium text-[var(--dude-text)]">
                          Firecrawl API key
                        </h4>
                      </div>
                      <input
                        type="password"
                        autoComplete="off"
                        value={preferences.runtime.credentials.firecrawlKey ?? ""}
                        onChange={(event) =>
                          updateCredential("firecrawlKey", event.target.value)
                        }
                        className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 font-mono text-sm text-[var(--dude-text)] outline-none transition-colors placeholder:text-[var(--dude-muted)] focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                        placeholder="fc-..."
                      />
                    </section>

                    <section className="grid gap-3 rounded-lg px-2 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <div>
                        <h4 className="text-sm font-medium text-[var(--dude-text)]">
                          Exa API key
                        </h4>
                      </div>
                      <input
                        type="password"
                        autoComplete="off"
                        value={preferences.runtime.credentials.exa ?? ""}
                        onChange={(event) =>
                          updateCredential("exa", event.target.value)
                        }
                        className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 font-mono text-sm text-[var(--dude-text)] outline-none transition-colors placeholder:text-[var(--dude-muted)] focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                        placeholder="exa-..."
                      />
                    </section>

                    <section className="grid gap-3 rounded-lg px-2 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
                      <div>
                        <h4 className="text-sm font-medium text-[var(--dude-text)]">
                          Gemini API key
                        </h4>
                        <p className="mt-1 text-xs text-[var(--dude-muted)]">
                          Used for semantic memory ranking when Postgres is
                          configured.
                        </p>
                      </div>
                      <input
                        type="password"
                        autoComplete="off"
                        value={preferences.runtime.credentials.gemini ?? ""}
                        onChange={(event) =>
                          updateCredential("gemini", event.target.value)
                        }
                        className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 font-mono text-sm text-[var(--dude-text)] outline-none transition-colors placeholder:text-[var(--dude-muted)] focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                        placeholder="AI..."
                      />
                    </section>
                  </div>
                </section>
              </div>
            </>
  );
}
