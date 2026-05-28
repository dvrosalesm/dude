import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import hostConfig from "../../../specialists.config.client";
import { createSpecialistRegistry } from "@dude/sdk";
import { DesktopAppShell } from "./desktop-app-shell";
import { LocalChatApp } from "./local-chat-app";

const registry = createSpecialistRegistry(hostConfig);

function SpecialistRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="flex h-full min-h-0 flex-1 items-center justify-center">
            <BrailleSpinner />
          </div>
        }
      >
        <Component />
      </Suspense>
    </div>
  );
}

export function AppRouter() {
  return (
    <DesktopAppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat/*" element={<LocalChatApp />} />
        <Route path="/preferences" element={<Navigate to="/chat/preferences" replace />} />
        {registry.list().map((plugin) => (
          <Route
            key={`${plugin.id}-list`}
            path={`/chat/specialists/${plugin.path}`}
            element={<SpecialistRoute component={plugin.ui.ListPage} />}
          />
        ))}
        {registry.list().map((plugin) => (
          <Route
            key={`${plugin.id}-workspace`}
            path={`/chat/specialists/${plugin.path}/:workspaceId/*`}
            element={<SpecialistRoute component={plugin.ui.WorkspacePage} />}
          />
        ))}
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </DesktopAppShell>
  );
}
