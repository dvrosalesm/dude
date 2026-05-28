"use client";

import { useRef, useState } from "react";
import { TooltipProvider } from "@dude/ui/components/tooltip";
import { EditorTopBar } from "./editor-top-bar";
import { SlideSidebar } from "./slide-sidebar";
import { DesignSidebar } from "./design-sidebar";
import { DocumentPreview } from "./document-preview";
import { FloatingChatPanel } from "@dude/chat/subagents/floating-chat-panel";
import { PresentationChatPanel } from "./presentation-chat-panel";
import type { SubagentMessage } from "@dude/chat/subagents/types";
import type { DocumentWorkspace } from "../types";

type EditorLayoutProps = {
  workspace: DocumentWorkspace | null;
  chatOpen: boolean;
  onChatOpenChange: (open: boolean) => void;
  messages: SubagentMessage[];
  setMessages: React.Dispatch<React.SetStateAction<SubagentMessage[]>>;
  messagesLoaded: boolean;
  onAssistantResponse: () => void;
  onPendingEdits: (edits: unknown[]) => void;
  setChatError: (error: string | null) => void;
  chatError?: string | null;
  onChatSendingChange?: (sending: boolean) => void;
  designStyle: string;
  onDesignStyleChange: (styleKey: string) => void;
  fontPair: string;
  onFontPairChange: (pairKey: string) => void;
  onResizeSlides: (width: number, height: number) => void;
  pendingPrompt?: string | null;
  onPromptConsumed?: () => void;
  onBack: () => void;
  onRename?: (name: string) => void;
  onSave?: () => Promise<void>;
  hasUnsavedChanges?: boolean;
};

export function EditorLayout({
  workspace,
  chatOpen,
  onChatOpenChange,
  messages,
  setMessages,
  messagesLoaded,
  onAssistantResponse,
  onPendingEdits,
  setChatError,
  chatError,
  onChatSendingChange,
  designStyle,
  onDesignStyleChange,
  fontPair,
  onFontPairChange,
  onResizeSlides,
  pendingPrompt,
  onPromptConsumed,
  onBack,
  onRename,
  onSave,
  hasUnsavedChanges,
}: EditorLayoutProps) {
  const designStyleRef = useRef(designStyle);
  designStyleRef.current = designStyle;
  const fontPairRef = useRef(fontPair);
  fontPairRef.current = fontPair;

  const [chatSending, setChatSending] = useState(false);

  const documentName = workspace?.configurations?.documentName;
  const messageCount = messages.filter((m) => !m.hidden).length;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full min-h-0 bg-[#f0f0f0]">
        <EditorTopBar
          workspaceName={workspace?.name || "Presentation Editor"}
          documentName={documentName}
          onBack={onBack}
          onRename={onRename}
          onSave={onSave}
          hasUnsavedChanges={hasUnsavedChanges}
        />
        <div className="flex flex-1 min-h-0 bg-[#f0f0f0]">
          {chatError && (
            <div className="absolute left-1/2 top-14 z-30 max-w-md -translate-x-1/2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive shadow">
              {chatError}
            </div>
          )}
          <div className="hidden md:flex min-h-0">
            <SlideSidebar />
          </div>
          <div className="relative flex-1 flex flex-col min-w-0">
            <DocumentPreview agentWorking={chatSending} />
            <FloatingChatPanel
              messageCount={messageCount}
              open={chatOpen}
              onOpenChange={onChatOpenChange}
              sending={chatSending}
            >
              <PresentationChatPanel
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
                designStyleRef={designStyleRef}
                fontPairRef={fontPairRef}
                onResizeSlides={onResizeSlides}
                pendingPrompt={pendingPrompt}
                onPromptConsumed={onPromptConsumed}
                messagesCollapsed={!chatOpen}
              />
            </FloatingChatPanel>
          </div>
          <div className="hidden lg:flex min-h-0">
            <DesignSidebar
              designStyle={designStyle}
              onDesignStyleChange={onDesignStyleChange}
              fontPair={fontPair}
              onFontPairChange={onFontPairChange}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
