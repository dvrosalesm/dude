import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, ImageIcon, MoreVertical, Pin, Trash2, X } from "lucide-react";
import { SubagentChat } from "@dude/chat/subagents/subagent-chat";
import { MainAssistantHome } from "@dude/chat/subagents/main-assistant-workspace";
import { ProjectHubPanel } from "@dude/chat/subagents/project-hub-panel";
import { SUBAGENT_META } from "@dude/chat/subagents/subagent-meta";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@dude/ui/components/dropdown-menu";
import { cn } from "@dude/ui/design-system";
import { AgentBlob, deriveAgentBlobState } from "@dude/ui/components/agent-blob";
import { browserChatRuntime, SUBAGENTS } from "../../local-chat-runtime";
import { navigateTo, subagentPath } from "../../route-utils";
import { DEFAULT_PREFERENCES, type DudePreferences } from "../../preferences";
import type {
  ProjectAgentCard,
  ProjectHubSnapshot,
  SubagentId,
  SubagentSummary,
} from "../../types";
import { SubagentsSidebar } from "../sidebar/subagents-sidebar";
import { isKnownSubagent } from "../shell/subagent-icons";
import { useLocalSubagentChat } from "./use-local-subagent-chat";

export function ChatSurface({
  subagentId,
  preferences = DEFAULT_PREFERENCES,
  subagents = SUBAGENTS,
}: {
  subagentId: SubagentId;
  preferences?: DudePreferences;
  subagents?: SubagentSummary[];
}) {
  const chat = useLocalSubagentChat({
    subagentId,
    assistantName: preferences.assistantName,
  });
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryPreview, setGalleryPreview] = useState<string | null>(null);
  const [projectHub, setProjectHub] = useState<ProjectHubSnapshot | null>(null);
  const [projectHubLoading, setProjectHubLoading] = useState(false);
  const isMainAssistant = subagentId === "main-assistant";
  const subagent = isMainAssistant
    ? undefined
    : SUBAGENTS.find((item) => item.id === subagentId);
  const shownMessages = showPinnedOnly
    ? chat.chatProps.messages.filter((message) => message.pinned)
    : chat.chatProps.messages;
  const hasPinned = chat.chatProps.messages.some((message) => message.pinned);
  const allImages = chat.chatProps.messages.flatMap((message) =>
    message.images ?? [],
  );
  const agentBlobState = deriveAgentBlobState({
    sending: chat.chatProps.sending,
    hasDraft: chat.chatProps.newMessage.trim().length > 0,
  });
  const assistantName = preferences.assistantName || "Dude";
  const knownSubagents = useMemo(
    () => subagents.filter(isKnownSubagent),
    [subagents],
  );
  const pinnedSnippets = useMemo(
    () =>
      chat.chatProps.messages
        .filter((message) => message.pinned && message.role === "assistant")
        .map((message) => ({
          id: message.id ?? message.message.slice(0, 24),
          preview: (message.answer ?? message.message).trim().replace(/\s+/g, " ").slice(0, 140),
        }))
        .filter((item) => item.preview.length > 0),
    [chat.chatProps.messages],
  );

  const refreshProjectHub = useCallback(async () => {
    if (!isMainAssistant || !browserChatRuntime.fetchProjectHub) return;
    setProjectHubLoading(true);
    try {
      const hub = await browserChatRuntime.fetchProjectHub("main-assistant");
      setProjectHub(hub);
    } finally {
      setProjectHubLoading(false);
    }
  }, [isMainAssistant]);

  useEffect(() => {
    if (isMainAssistant) void refreshProjectHub();
  }, [isMainAssistant, refreshProjectHub]);

  useEffect(() => {
    if (isMainAssistant && !chat.chatProps.sending) {
      void refreshProjectHub();
    }
  }, [
    isMainAssistant,
    chat.chatProps.sending,
    chat.chatProps.messages.length,
    refreshProjectHub,
  ]);

  const closeGallery = useCallback(() => {
    setShowGallery(false);
    setGalleryPreview(null);
  }, []);

  useEffect(() => {
    if (!showGallery) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (galleryPreview) {
        setGalleryPreview(null);
        return;
      }
      closeGallery();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showGallery, galleryPreview, closeGallery]);

  function subagentLabel(id: string) {
    return SUBAGENT_META[id]?.label ?? id;
  }

  function handleInstructAgent(agent: ProjectAgentCard) {
    chat.chatProps.onMessageChange(
      `Tell ${subagentLabel(agent.subagentId)} in workspace "${agent.workspaceName}" (${agent.workspaceId}) to: `,
    );
  }

  function handleReviewAgent(agent: ProjectAgentCard) {
    void chat.chatProps.onSend(
      `Review the latest work from ${subagentLabel(agent.subagentId)} in workspace "${agent.workspaceName}" (${agent.workspaceId}). Summarize what was done, what's missing, and recommend next steps.`,
    );
  }

  function handleOpenAgent(agent: ProjectAgentCard) {
    navigateTo(
      subagentPath(agent.subagentId as SubagentId, agent.workspaceId),
    );
  }

  function handleMainSuggestionAction(action: string, args: string[]) {
    if (action === "open-subagent") {
      const [subagentIdArg, workspaceId] = args;
      if (subagentIdArg) {
        navigateTo(subagentPath(subagentIdArg as SubagentId, workspaceId || undefined));
      }
      return;
    }
    if (action === "instruct-agent") {
      const [subagentIdArg, workspaceId] = args;
      const agent = projectHub?.agents.find(
        (row) =>
          row.subagentId === subagentIdArg &&
          row.workspaceId === workspaceId,
      );
      if (agent) {
        handleInstructAgent(agent);
        return;
      }
      chat.chatProps.onMessageChange(
        `Tell ${subagentLabel(subagentIdArg)} to: `,
      );
      return;
    }
    if (action === "review-agent") {
      const [subagentIdArg, workspaceId] = args;
      const agent = projectHub?.agents.find(
        (row) =>
          row.subagentId === subagentIdArg &&
          row.workspaceId === workspaceId,
      );
      if (agent) {
        handleReviewAgent(agent);
        return;
      }
      void chat.chatProps.onSend(
        `Review the latest work from ${subagentLabel(subagentIdArg)} in workspace ${workspaceId}. Summarize what was done and recommend next steps.`,
      );
      return;
    }
    if (action === "import-data") {
      navigateTo(subagentPath("data-analyst"));
    }
  }

  return (
    <div
      className={cn(
        "relative flex h-full min-w-0 flex-col",
        isMainAssistant ? "bg-transparent" : "bg-[var(--dude-bg)]",
      )}
    >
      {isMainAssistant ? (
        <>
          <header className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-4">
            <div className="pointer-events-none flex flex-col items-center gap-2 pb-2 pt-1">
              <AgentBlob
                state={agentBlobState}
                size={44}
                aria-label={assistantName}
              />
              {chat.chatProps.sending && shownMessages.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Working on your request…
                </p>
              )}
            </div>
          </header>

          <SubagentsSidebar
            subagents={subagents}
            showPinnedOnly={showPinnedOnly}
            onTogglePinnedOnly={() => setShowPinnedOnly((current) => !current)}
            onShowGallery={() => setShowGallery(true)}
            onNewConversation={() => chat.clear()}
            onOpenPreferences={() => navigateTo("/chat/preferences")}
          />
        </>
      ) : (
        <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 pointer-events-none">
          <div className="pointer-events-auto relative flex items-center gap-2 rounded-xl bg-[var(--dude-text-soft)] py-1.5 pl-1.5 pr-2 backdrop-blur-2xl">
            <button
              type="button"
              onClick={() => navigateTo("/chat")}
              className="shrink-0 rounded-lg transition-opacity hover:opacity-80"
              aria-label="Back to assistant"
            >
              <AgentBlob
                state={agentBlobState}
                size={32}
                aria-label={subagent?.name ?? preferences.assistantName}
              />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-center p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground"
                  aria-label="Options"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                side="bottom"
                sideOffset={16}
                className="min-w-0 bg-background/90 p-1 backdrop-blur-xl"
              >
                <DropdownMenuItem
                  onClick={() => setShowPinnedOnly((current) => !current)}
                  className="gap-1.5 px-3 py-1.5 text-[11px]"
                >
                  <Pin className="h-3 w-3" />
                  {showPinnedOnly ? "Show all" : "Pinned"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowGallery(true)}
                  className="gap-1.5 px-3 py-1.5 text-[11px]"
                >
                  <ImageIcon className="h-3 w-3" />
                  Images
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigateTo("/chat/preferences")}
                  className="gap-1.5 px-3 py-1.5 text-[11px]"
                >
                  <Heart className="h-3 w-3" />
                  Preferences
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => chat.clear()}
                  className="gap-1.5 px-3 py-1.5 text-[11px] text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                  New conversation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <div className={cn("flex min-h-0 flex-1 flex-col", isMainAssistant && "pt-24")}>
        <SubagentChat
          {...chat.chatProps}
          messages={shownMessages}
          inputLayout="docked"
          inputMaxWidthClass="max-w-3xl"
          historyLayout={isMainAssistant ? "stage" : "bubbles"}
          workspaceHome={
            isMainAssistant ? (
              showPinnedOnly && !hasPinned ? (
                <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-2 py-6 text-center">
                  <Pin className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground/50">
                    No pinned messages yet
                  </p>
                </div>
              ) : showPinnedOnly ? undefined : (
                <MainAssistantHome
                  assistantName={assistantName}
                  subagents={knownSubagents}
                  pinnedSnippets={pinnedSnippets}
                  onStarterPrompt={(prompt) => void chat.chatProps.onSend(prompt)}
                  onSubagentClick={(id) =>
                    navigateTo(subagentPath(id as SubagentId))
                  }
                  onShowPinned={() => setShowPinnedOnly(true)}
                />
              )
            ) : undefined
          }
          onSuggestionAction={
            isMainAssistant ? handleMainSuggestionAction : undefined
          }
          projectHub={
            isMainAssistant ? (
              <ProjectHubPanel
                hub={projectHub}
                loading={projectHubLoading}
                onInstruct={handleInstructAgent}
                onReview={handleReviewAgent}
                onOpen={handleOpenAgent}
                onManageProject={() =>
                  void chat.chatProps.onSend(
                    "List every workspace in this project, summarize what each internal agent has done, and help me decide what to do next.",
                  )
                }
              />
            ) : undefined
          }
          placeholder={isMainAssistant ? "write here" : chat.chatProps.placeholder}
          inputVariant={isMainAssistant ? "open" : "bar"}
          inputPlaceholderStyle={isMainAssistant ? "scribble" : "default"}
          wrapperLayout={isMainAssistant ? "fill" : "auto"}
        />
      </div>

      {showGallery && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close images"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeGallery}
          />
          <div className="relative flex h-full flex-col pointer-events-none">
            <div className="pointer-events-auto flex shrink-0 items-center justify-between px-5 py-4">
              <span className="text-sm font-semibold text-white">
                Images ({allImages.length})
              </span>
              <button
                type="button"
                onClick={closeGallery}
                className="p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {galleryPreview ? (
              <div className="flex min-h-0 flex-1 items-center justify-center p-4">
                <img
                  src={galleryPreview}
                  alt="Preview"
                  className="pointer-events-auto max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {allImages.length > 0 ? (
                  <div className="pointer-events-auto mx-auto grid max-w-3xl grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
                    {allImages.map((src, index) => (
                      <button
                        key={`${src}-${index}`}
                        type="button"
                        onClick={() => setGalleryPreview(src)}
                        className="aspect-square overflow-hidden transition-opacity hover:opacity-80"
                      >
                        <img
                          src={src}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-white/40">
                    <ImageIcon className="mb-2 h-10 w-10" />
                    <p className="text-sm">No images yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
