"use client";

import { Trash2 } from "lucide-react";
import type { LlmProviderKind } from "@dude/sdk/runner";
import type { DudePreferences } from "../../preferences";
import { usePreferenceUpdaters } from "./use-preference-updaters";

export function PreferencesGeneralSection({
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
              <h2 className="mb-8 text-3xl font-semibold tracking-normal text-[var(--dude-text)]">
                General Settings
              </h2>
              <div className="max-w-2xl space-y-2">
                <section className="grid gap-3 rounded-lg px-2 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
                  <div>
                    <h3 className="text-sm font-medium tracking-normal text-[var(--dude-text)]">
                      Name
                    </h3>
                  </div>
                  <input
                    id="dude-assistant-name"
                    value={preferences.assistantName}
                    onChange={(event) =>
                      updatePreference({ assistantName: event.target.value })
                    }
                    onBlur={() => {
                      const name = preferences.assistantName.trim() || "Dude";
                      updatePreference({ assistantName: name });
                    }}
                    className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 text-sm text-[var(--dude-text)] outline-none transition-colors placeholder:text-[var(--dude-muted)] focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface)]"
                    placeholder="Dude"
                  />
                </section>
              </div>
            </>
  );
}
