"use client";

import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { WorkspaceHeaderBar } from "@dude/chat/specialists/workspace-header-bar";
import {
  SpecialistWorkspaceFrame,
  SpecialistWorkspaceMain,
} from "@dude/chat/specialists/specialist-workspace-layout";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import { FloatingChatPanel } from "@dude/chat/specialists/floating-chat-panel";
import { useDesignBrandingStore } from "@dude/specialist-design-branding/store";
import { useSpecialistWorkspaceLoader } from "@dude/chat/specialists/hooks/use-specialist-workspace-loader";
import { updateWorkspaceById } from "@dude/workspaces";
import { specialistListPath } from "@dude/workspaces/routes";
import type { DesignCanvasSnapshot } from "@dude/specialist-design-branding/lib/types";
import { ChatPanel } from "./components/chat-panel";
import { CanvasSuggestions } from "./components/canvas-suggestions";

const DesignCanvas = lazy(() =>
  import("./components/design-canvas").then((mod) => ({ default: mod.DesignCanvas })),
);

export default function DesignBrandingWorkspacePage() {
  const store = useDesignBrandingStore();
  const { setWorkspaceData, setCanvasSnapshot } = store;

  const applyConfig = useCallback(
    (config: Record<string, unknown>, meta: { workspaceId: string }) => {
      setWorkspaceData({
        workspaceId: meta.workspaceId,
        canvasSnapshot: (config.canvasSnapshot as never) || { nodes: [], edges: [] },
        brandBook: (config.brandBook as never) || [],
        palettes: (config.palettes as never) || [],
        typography: (config.typography as never) || [],
        logos: (config.logos as never) || [],
        reviews: (config.reviews as never) || [],
        tokensExports: (config.tokensExports as never) || [],
        loading: false,
      });
    },
    [setWorkspaceData],
  );

  const {
    workspaceId,
    workspaceName,
    loading,
    setError,
    chatMessages,
    setChatMessages,
    chatMessagesLoaded,
    refreshWorkspace,
    handleRename,
  } = useSpecialistWorkspaceLoader({
    defaultName: "Design",
    applyConfig,
    resetState: () => store.reset(),
  });

  const [chatOpen, setChatOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistSnapshot = useCallback(
    (snapshot: DesignCanvasSnapshot) => {
      if (!workspaceId) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void updateWorkspaceById(workspaceId, {
          configurations: { canvasSnapshot: snapshot },
        }).catch(() => {});
      }, 800);
    },
    [workspaceId],
  );

  const handleSnapshotChange = useCallback(
    (snapshot: DesignCanvasSnapshot) => {
      setCanvasSnapshot(snapshot);
      persistSnapshot(snapshot);
    },
    [persistSnapshot, setCanvasSnapshot],
  );

  const visibleMessageCount = useMemo(
    () => chatMessages.filter((m) => !m.hidden).length,
    [chatMessages],
  );

  const canvasIsEmpty = (store.canvasSnapshot?.nodes?.length ?? 0) === 0;

  const handleSuggestion = useCallback((prompt: string) => {
    setPendingPrompt(prompt);
    setChatOpen(true);
  }, []);

  const clearPendingPrompt = useCallback(() => {
    setPendingPrompt(null);
  }, []);

  if (loading) {
    return (
      <SpecialistWorkspaceFrame className="items-center justify-center">
        <BrailleSpinner className="text-2xl text-muted-foreground/60" />
      </SpecialistWorkspaceFrame>
    );
  }

  return (
    <SpecialistWorkspaceFrame>
      <WorkspaceHeaderBar
        title={workspaceName}
        backHref={specialistListPath("design-branding")}
        backLabel={"Back to workspaces"}
        onRename={handleRename}
      />

      <SpecialistWorkspaceMain>
        <div className="flex-1 min-w-0 relative">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <BrailleSpinner className="text-2xl text-muted-foreground/60" />
              </div>
            }
          >
            <DesignCanvas
              initialSnapshot={store.canvasSnapshot}
              onSnapshotChange={handleSnapshotChange}
            />
          </Suspense>
          {canvasIsEmpty && (
            <CanvasSuggestions
              onSelect={handleSuggestion}
              title={"What do you want to design?"}
              subtitle={"Pick a starting point — or just type your own prompt below."}
            />
          )}
          <FloatingChatPanel
            messageCount={visibleMessageCount}
            open={chatOpen}
            onOpenChange={setChatOpen}
          >
            <ChatPanel
              setError={setError}
              onWorkspaceChanged={refreshWorkspace}
              messages={chatMessages}
              setMessages={setChatMessages}
              messagesLoaded={chatMessagesLoaded}
              collapsed={!chatOpen}
              pendingPrompt={pendingPrompt}
              onPromptConsumed={clearPendingPrompt}
            />
          </FloatingChatPanel>
        </div>
      </SpecialistWorkspaceMain>
    </SpecialistWorkspaceFrame>
  );
}
