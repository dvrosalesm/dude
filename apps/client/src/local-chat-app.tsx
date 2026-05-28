import { useEffect, useMemo, useState } from "react";
import { useRoutePath, parseRoute } from "./route-utils";
import {
  DUDE_PREFERENCES_KEY,
  readStoredPreferences,
  type DudePreferences,
} from "./preferences";
import { SPECIALISTS } from "./local-chat-runtime";
import { applyTheme } from "./features/shell/specialist-icons";
import { PreferencesView } from "./features/preferences/preferences-view";
import { SpecialistsDirectory } from "./features/specialists/specialists-directory";
import {
  SpecialistListRoute,
  SpecialistWorkspaceRoute,
} from "./features/shell/specialist-routes";
import { ChatSurface } from "./features/chat/chat-surface";
import { attachAgentDebugHooks } from "./agent-debug";

export function LocalChatApp() {
  const path = useRoutePath();
  const route = useMemo(() => parseRoute(path), [path]);
  const [preferences, setPreferences] = useState<DudePreferences>(() =>
    readStoredPreferences(),
  );

  useEffect(() => {
    attachAgentDebugHooks();
  }, []);

  useEffect(() => {
    applyTheme(preferences.theme);
    window.localStorage.setItem(
      DUDE_PREFERENCES_KEY,
      JSON.stringify(preferences),
    );
  }, [preferences]);

  useEffect(() => {
    const handlePreferencesChanged = () => {
      setPreferences(readStoredPreferences());
    };
    window.addEventListener(
      "dude-preferences-changed",
      handlePreferencesChanged,
    );
    return () => {
      window.removeEventListener(
        "dude-preferences-changed",
        handlePreferencesChanged,
      );
    };
  }, []);

  return (
    <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
      {route.section === "preferences" ? (
        <PreferencesView
          preferences={preferences}
          onChange={setPreferences}
        />
      ) : route.section === "specialists" && !route.specialistId ? (
        <SpecialistsDirectory specialists={SPECIALISTS} />
      ) : route.section === "specialists" &&
        route.specialistId &&
        !route.workspaceId ? (
        <SpecialistListRoute specialistId={route.specialistId} />
      ) : route.section === "specialists" &&
        route.specialistId &&
        route.workspaceId ? (
        <SpecialistWorkspaceRoute specialistId={route.specialistId} />
      ) : (
        <ChatSurface
          specialistId={route.specialistId ?? "main-assistant"}
          preferences={preferences}
          specialists={SPECIALISTS}
        />
      )}
    </main>
  );
}
