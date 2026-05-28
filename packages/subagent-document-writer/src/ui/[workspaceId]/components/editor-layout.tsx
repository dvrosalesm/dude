"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { EditorTopBar } from "./editor-top-bar";
import { LayoutTab } from "./layout-tab";
import { WriterCanvas } from "./writer-canvas";
import { ChatSection } from "./chat-section";
import { AIGenerationOverlay } from "@dude/ui/components/ai-generation-overlay";
import type { SubagentMessage } from "@dude/chat/subagents/types";
import type { WriterWorkspace } from "../types";

type EditorLayoutProps = {
  workspace: WriterWorkspace | null;
  processing: boolean;
  messages: SubagentMessage[];
  setMessages: React.Dispatch<React.SetStateAction<SubagentMessage[]>>;
  messagesLoaded: boolean;
  onAssistantResponse: () => void;
  onPendingEdits: (edits: unknown[]) => void;
  chatError: string | null;
  setChatError: (error: string | null) => void;
  onSave: (updates: Record<string, unknown>) => void;
  onBack: () => void;
  onRename?: (name: string) => void;
  onChatSendingChange?: (sending: boolean) => void;
};

export function EditorLayout({
  workspace,
  processing,
  messages,
  setMessages,
  messagesLoaded,
  onAssistantResponse,
  onPendingEdits,
  chatError,
  setChatError,
  onSave,
  onBack,
  onRename,
  onChatSendingChange,
}: EditorLayoutProps) {
  const [showLayout, setShowLayout] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [chatSending, setChatSending] = useState(false);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f0f0f0] print:h-auto print:bg-card print:block">
      <EditorTopBar
        workspaceName={workspace?.name || "Document Writer"}
        showLayout={showLayout}
        onToggleLayout={() => setShowLayout((v) => !v)}
        onBack={onBack}
        onRename={onRename}
      />

      <div className="relative flex-1 flex min-h-0 print:block print:overflow-visible print:h-auto">
        {chatError && (
          <div className="absolute left-1/2 top-3 z-30 max-w-md -translate-x-1/2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive shadow print:hidden">
            {chatError}
          </div>
        )}
        {/* Left: Chat */}
        {showChat && (
          <div className="absolute inset-0 z-20 bg-muted flex flex-col print:hidden md:static md:inset-auto md:z-auto md:w-[580px] md:shrink-0">
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setShowChat(false)}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow hover:text-foreground md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
            <ChatSection
              messages={messages}
              setMessages={setMessages}
              messagesLoaded={messagesLoaded}
              onAssistantResponse={onAssistantResponse}
              onPendingEdits={onPendingEdits}
              setChatError={setChatError}
              onSendingChange={(sending) => {
                setChatSending(sending);
                onChatSendingChange?.(sending);
              }}
            />
          </div>
        )}

        {/* Center: Document editor */}
        <div className="relative flex-1 flex flex-col min-w-0">
          <WriterCanvas
            processing={processing}
            agentBusy={chatSending}
            showChat={showChat}
            onToggleChat={() => setShowChat((v) => !v)}
          />
          <AIGenerationOverlay active={chatSending || processing} />
        </div>

        {/* Right: Layout sidebar (collapsible) */}
        {showLayout && (
          <div className="absolute inset-0 z-20 bg-muted overflow-y-auto print:hidden md:static md:inset-auto md:z-auto md:w-[320px] md:shrink-0">
            <button
              type="button"
              aria-label="Close layout panel"
              onClick={() => setShowLayout(false)}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow hover:text-foreground md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
            <LayoutTab onSave={onSave} />
          </div>
        )}
      </div>
    </div>
  );
}
