"use client";

import { useEffect } from "react";
import { SubagentChat } from "@dude/chat/subagents/subagent-chat";
import { useSubagentChat } from "@dude/chat/subagents/hooks/use-subagent-chat";
import type { SubagentMessage } from "@dude/chat/subagents/types";
import { FileEdit, Globe } from "lucide-react";
import type { LandingPage, Lead } from "@dude/subagent-prospect/lib/config";

interface DesignRefDetail {
  id: string;
  label: string;
  selector: string;
  html: string;
  rect?: { x: number; y: number; w: number; h: number } | null;
}

interface ProspectChatPanelProps {
  messages: SubagentMessage[];
  setMessages: React.Dispatch<React.SetStateAction<SubagentMessage[]>>;
  messagesLoaded: boolean;
  onWorkspaceChanged: () => Promise<void>;
  onSendingChange?: (sending: boolean) => void;
  landingPages: LandingPage[];
  leads: Lead[];
  workspaceId?: string;
}

const TOOL_ICONS = {
  update_landing_page: FileEdit,
  update_form_fields: FileEdit,
  publish_landing_page: Globe,
};

function toolArgPreview(
  tool: string,
  args: Record<string, unknown>,
): string {
  if (tool === "update_landing_page")
    return String(args.title || "").slice(0, 120);
  if (tool === "update_form_fields") {
    const fields = args.fields as StringKeyRecord[];
    return fields
      ? fields.map((f: JsonValue) => f.label || f.name).join(", ").slice(0, 120)
      : "";
  }
  if (tool === "publish_landing_page")
    return args.published ? "Publishing..." : "Unpublishing...";
  return JSON.stringify(args).slice(0, 120);
}

export function ProspectChatPanel({
  messages,
  setMessages,
  messagesLoaded,
  onWorkspaceChanged,
  onSendingChange,
  landingPages,
  leads,
  workspaceId,
}: ProspectChatPanelProps) {
  const chat = useSubagentChat({
    subagentId: "prospect",
    workspaceId,
    messages,
    setMessages,
    messagesLoaded,
    bootMessage: () =>
      landingPages.length > 0
        ? `Greet the user and ask what they'd like to work on. They have ${landingPages.length} landing page(s) and ${leads.length} lead(s). Keep it brief and friendly.`
        : `The user just opened a new website workspace. Introduce yourself as the Website Subagent, explain what you can do (build websites, funnels, lead capture flows, and analytics), and ask about their product/service, target audience, and conversion goal so you can recommend the right direction. Keep it brief and friendly.`,
    wakingUpLabel: "Starting your website subagent...",
    placeholder: "Describe the website or funnel you want to build...",
    onAssistantResponse: onWorkspaceChanged,
  });

  useEffect(() => {
    onSendingChange?.(chat.sending);
  }, [chat.sending, onSendingChange]);

  // Design mode: receive picked elements from the preview iframe (relayed via
  // a window CustomEvent in landing-page-preview.tsx) and add them as a
  // FileReference pill above the chat input. Single-select: a new pick
  // replaces the previously selected element. The hook concatenates the
  // pill's `content` to the outgoing message and clears it on send.
  const fileReferences = chat.chatProps.fileReferences;
  const onAddFileReference = chat.chatProps.onAddFileReference;
  const onRemoveFileReference = chat.chatProps.onRemoveFileReference;
  useEffect(() => {
    function onDesignRef(event: Event) {
      const detail = (event as CustomEvent<DesignRefDetail>).detail;
      if (!detail) return;
      // Drop any previously picked refs — only the latest selection counts.
      if (fileReferences && onRemoveFileReference) {
        for (const r of fileReferences) onRemoveFileReference(r.id);
      }
      const content =
        `[REF]\n` +
        `selector: ${detail.selector}\n` +
        `html:\n${detail.html}\n` +
        `[/REF]`;
      onAddFileReference?.({
        id: detail.id,
        name: detail.label,
        content,
      });
      // Focus the input so the user can immediately type their instruction.
      // Defer to the next tick so the pill render has flushed first.
      requestAnimationFrame(() => {
        const input = document.querySelector<HTMLTextAreaElement>(
          'textarea[data-subagent-input="true"]',
        );
        input?.focus();
      });
    }
    window.addEventListener("prospect:design-ref", onDesignRef as EventListener);
    return () =>
      window.removeEventListener("prospect:design-ref", onDesignRef as EventListener);
  }, [fileReferences, onAddFileReference, onRemoveFileReference]);

  return (
    <SubagentChat
      {...chat.chatProps}
      toolIcons={TOOL_ICONS}
      argPreview={toolArgPreview}
      inputLayout="docked"
    />
  );
}
