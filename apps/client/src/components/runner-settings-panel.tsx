import { useState, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import {
  DEFAULT_RUNNER_SETTINGS,
  getAgentRunnerManifest,
  isBuiltinRunnerId,
  type AgentRunnerId,
  type AgentRunnerSettings,
} from "@dude/sdk/runner";
import { cn } from "@dude/ui/design-system";
import { useAgentRunners } from "../hooks/use-agent-runners";
import type { DudePreferences } from "../preferences";

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-lg px-2 py-2 sm:grid-cols-[180px_1fr] sm:items-start">
      <div>
        <h4 className="text-sm font-medium text-[var(--dude-text)]">{label}</h4>
        {hint ? (
          <p className="mt-1 text-xs leading-relaxed text-[var(--dude-muted)]">{hint}</p>
        ) : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

function inputClassName() {
  return "h-9 w-full rounded-md border border-transparent bg-transparent px-2 font-mono text-sm text-[var(--dude-text)] outline-none transition-colors placeholder:text-[var(--dude-muted)] focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]";
}

function selectClassName() {
  return "h-9 w-full rounded-md border border-transparent bg-[var(--dude-surface)] px-2 text-sm text-[var(--dude-text)] outline-none transition-colors focus:border-[var(--dude-line)]";
}

export function RunnerSettingsPanel({
  preferences,
  onChange,
}: {
  preferences: DudePreferences;
  onChange: (preferences: DudePreferences) => void;
}) {
  const runners = useAgentRunners();
  const [selectedRunner, setSelectedRunner] = useState<AgentRunnerId>(
    getAgentRunnerManifest(preferences.agentRunner)
      ? preferences.agentRunner
      : "pi",
  );

  function updateRunnerConfigs(
    runnerId: AgentRunnerId,
    updates: Partial<NonNullable<AgentRunnerSettings[keyof AgentRunnerSettings]>>,
  ) {
    if (!isBuiltinRunnerId(runnerId)) return;
    onChange({
      ...preferences,
      runnerConfigs: {
        ...preferences.runnerConfigs,
        [runnerId]: {
          ...preferences.runnerConfigs[runnerId],
          ...updates,
        },
      },
    });
  }

  const manifest = getAgentRunnerManifest(selectedRunner);

  return (
    <>
      <h2 className="mb-3 text-3xl font-semibold tracking-normal text-[var(--dude-text)]">
        AI Runners
      </h2>
      <p className="mb-8 max-w-2xl text-sm leading-relaxed text-[var(--dude-muted)]">
        Choose the background harness that executes specialist work. Each runner has its
        own setup — Pi uses your LLM provider from API &amp; Models; Cursor SDK uses its
        own API key and model below.
      </p>

      <div className="grid max-w-4xl gap-8 lg:grid-cols-[240px_1fr]">
        <div className="space-y-2">
          {runners.map((runner) => {
            const isDefault = preferences.agentRunner === runner.id;
            const isSelected = selectedRunner === runner.id;
            return (
              <button
                key={runner.id}
                type="button"
                onClick={() => {
                  setSelectedRunner(runner.id);
                }}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left transition-colors",
                  isSelected
                    ? "bg-[var(--dude-surface-2)] text-[var(--dude-text)]"
                    : "text-[var(--dude-muted)] hover:bg-[var(--dude-surface-2)] hover:text-[var(--dude-text)]",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{runner.label}</span>
                  {isDefault ? (
                    <span className="rounded bg-[var(--dude-accent)]/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--dude-accent)]">
                      Default
                    </span>
                  ) : null}
                </div>
                <span className="mt-1 block text-xs leading-relaxed text-[var(--dude-muted)]">
                  {runner.description}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2">
            <div>
              <h3 className="text-lg font-semibold text-[var(--dude-text)]">
                {manifest?.label ?? selectedRunner}
              </h3>
              {manifest?.homepage ? (
                <a
                  href={manifest.homepage}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--dude-muted)] hover:text-[var(--dude-text)]"
                >
                  Documentation
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
            {preferences.agentRunner !== selectedRunner ? (
              <button
                type="button"
                onClick={() => onChange({ ...preferences, agentRunner: selectedRunner })}
                className="rounded-md bg-[var(--dude-accent)] px-3 py-1.5 text-sm font-medium text-[var(--dude-bg)] transition-opacity hover:opacity-90"
              >
                Set as default runner
              </button>
            ) : null}
          </div>

          {manifest?.installHint ? (
            <p className="mb-2 px-2 text-xs leading-relaxed text-[var(--dude-muted)]">
              {manifest.installHint}
            </p>
          ) : null}

          {isBuiltinRunnerId(selectedRunner) && selectedRunner === "pi" ? (
            <>
              <FieldRow
                label="Max iterations"
                hint="Tool-call loop limit per chat turn."
              >
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={preferences.runnerConfigs.pi?.maxIterations ?? DEFAULT_RUNNER_SETTINGS.pi.maxIterations}
                  onChange={(event) =>
                    updateRunnerConfigs("pi", {
                      maxIterations: Number(event.target.value) || DEFAULT_RUNNER_SETTINGS.pi.maxIterations,
                    })
                  }
                  className={inputClassName()}
                />
              </FieldRow>
              <FieldRow
                label="Approval mode"
                hint="How Pi handles tool calls that need confirmation."
              >
                <select
                  value={preferences.runnerConfigs.pi?.approvalMode ?? "auto"}
                  onChange={(event) =>
                    updateRunnerConfigs("pi", {
                      approvalMode: event.target.value as "auto" | "draft" | "per-step",
                    })
                  }
                  className={selectClassName()}
                >
                  <option value="auto">Auto — run tools without prompts</option>
                  <option value="draft">Draft — propose before executing</option>
                  <option value="per-step">Per step — confirm each tool call</option>
                </select>
              </FieldRow>
              <p className="px-2 pt-2 text-xs leading-relaxed text-[var(--dude-muted)]">
                Pi uses the LLM provider and API keys from{" "}
                <span className="text-[var(--dude-text)]">API &amp; Models</span>.
                MCP servers, skills, and source tools come from{" "}
                <span className="text-[var(--dude-text)]">App Configurations</span>.
              </p>
            </>
          ) : null}

          {isBuiltinRunnerId(selectedRunner) && selectedRunner === "codex" ? (
            <>
              <FieldRow
                label="Codex CLI"
                hint="Binary name or absolute path. Must be installed and on PATH unless you use a full path."
              >
                <input
                  value={preferences.runnerConfigs.codex?.cliBin ?? DEFAULT_RUNNER_SETTINGS.codex.cliBin}
                  onChange={(event) =>
                    updateRunnerConfigs("codex", { cliBin: event.target.value })
                  }
                  className={inputClassName()}
                  placeholder="codex"
                />
              </FieldRow>
              <p className="px-2 pt-2 text-xs leading-relaxed text-[var(--dude-muted)]">
                Codex uses your existing CLI login (
                <code className="rounded bg-[var(--dude-surface-2)] px-1 py-0.5 font-mono text-[11px]">
                  codex login
                </code>
                ). No OpenRouter key is required when Codex is the selected runner.
                Install:{" "}
                <code className="rounded bg-[var(--dude-surface-2)] px-1 py-0.5 font-mono text-[11px]">
                  npm install -g @openai/codex
                </code>
              </p>
            </>
          ) : null}

          {isBuiltinRunnerId(selectedRunner) && selectedRunner === "hermes" ? (
            <>
              <FieldRow
                label="Hermes CLI"
                hint="Binary name or absolute path for the Hermes agent."
              >
                <input
                  value={preferences.runnerConfigs.hermes?.cliBin ?? DEFAULT_RUNNER_SETTINGS.hermes.cliBin}
                  onChange={(event) =>
                    updateRunnerConfigs("hermes", { cliBin: event.target.value })
                  }
                  className={inputClassName()}
                  placeholder="hermes"
                />
              </FieldRow>
              <p className="px-2 pt-2 text-xs leading-relaxed text-[var(--dude-muted)]">
                Hermes adapter uses Dude&apos;s tool host plus your LLM keys from{" "}
                <span className="text-[var(--dude-text)]">API &amp; Models</span>.
              </p>
            </>
          ) : null}

          {isBuiltinRunnerId(selectedRunner) && selectedRunner === "cursor" ? (
            <>
              <FieldRow
                label="Cursor API key"
                hint="Create at cursor.com/dashboard/integrations. Required when Cursor SDK is the default runner."
              >
                <input
                  type="password"
                  autoComplete="off"
                  value={preferences.runnerConfigs.cursor?.apiKey ?? ""}
                  onChange={(event) =>
                    updateRunnerConfigs("cursor", {
                      apiKey: event.target.value.trim() || undefined,
                    })
                  }
                  className={inputClassName()}
                  placeholder="cursor_..."
                />
              </FieldRow>
              <FieldRow
                label="Cursor model"
                hint="Composer model id passed to Agent.create."
              >
                <input
                  value={
                    preferences.runnerConfigs.cursor?.model ??
                    DEFAULT_RUNNER_SETTINGS.cursor.model
                  }
                  onChange={(event) =>
                    updateRunnerConfigs("cursor", { model: event.target.value })
                  }
                  className={inputClassName()}
                  placeholder="composer-2.5"
                />
              </FieldRow>
              <p className="px-2 pt-2 text-xs leading-relaxed text-[var(--dude-muted)]">
                Cursor SDK runs locally via{" "}
                <code className="rounded bg-[var(--dude-surface-2)] px-1 py-0.5 font-mono text-[11px]">
                  @cursor/sdk
                </code>
                . It does not use the OpenRouter/OpenAI keys from API &amp; Models.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
