"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Braces,
  Cpu,
  KeyRound,
  Palette,
  Settings,
} from "lucide-react";
import { prefsNavItemClassName } from "@dude/ui/design-system";
import { navigateTo } from "../../route-utils";
import type { DudePreferences } from "../../preferences";
import { RunnerSettingsPanel } from "../../components/runner-settings-panel";
import { DesignSystemPage } from "../../components/design-system-page";
import { PreferencesGeneralSection } from "./preferences-general-section";
import { PreferencesApiSection } from "./preferences-api-section";
import { PreferencesAppConfigSection } from "./preferences-app-config-section";

export function PreferencesView({
  preferences,
  onChange,
}: {
  preferences: DudePreferences;
  onChange: (preferences: DudePreferences) => void;
}) {
  const [activeSection, setActiveSection] = useState<
    "general" | "ai-runners" | "api-settings" | "app-configurations" | "design-system"
  >("general");

  return (
    <section className="h-full overflow-y-auto bg-[var(--dude-bg)] text-[var(--dude-text)]">
      <div className="mx-auto grid min-h-full w-full max-w-6xl grid-cols-1 gap-8 px-4 pb-16 pt-6 sm:px-8 sm:pt-10 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-10 lg:h-fit">
          <button
            type="button"
            onClick={() => navigateTo("/chat")}
            className="mb-8 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--dude-muted)] transition-colors hover:text-[var(--dude-text)]"
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <nav aria-label="Preferences sections" className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveSection("general")}
              className={prefsNavItemClassName(activeSection === "general")}
            >
              <Settings className="h-4 w-4" />
              General
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("ai-runners")}
              className={prefsNavItemClassName(activeSection === "ai-runners")}
            >
              <Cpu className="h-4 w-4" />
              AI Runners
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("api-settings")}
              className={prefsNavItemClassName(activeSection === "api-settings")}
            >
              <KeyRound className="h-4 w-4" />
              API &amp; Models
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("app-configurations")}
              className={prefsNavItemClassName(activeSection === "app-configurations")}
            >
              <Braces className="h-4 w-4" />
              App Configurations
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("design-system")}
              className={prefsNavItemClassName(activeSection === "design-system")}
            >
              <Palette className="h-4 w-4" />
              Design System
            </button>
          </nav>
        </aside>

        <main className="pt-1">
          {activeSection === "general" ? (
            <PreferencesGeneralSection preferences={preferences} onChange={onChange} />
          ) : activeSection === "ai-runners" ? (
            <RunnerSettingsPanel preferences={preferences} onChange={onChange} />
          ) : activeSection === "api-settings" ? (
            <PreferencesApiSection preferences={preferences} onChange={onChange} />
          ) : activeSection === "design-system" ? (
            <DesignSystemPage theme={preferences.theme} />
          ) : (
            <PreferencesAppConfigSection preferences={preferences} onChange={onChange} />
          )}
        </main>
      </div>
    </section>
  );
}
