"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkspaceHeaderBar } from "@dude/chat/specialists/workspace-header-bar";
import {
  SpecialistWorkspaceFrame,
  SpecialistWorkspaceMain,
} from "@dude/chat/specialists/specialist-workspace-layout";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import type { SpecialistMessage } from "@dude/chat/specialists/types";
import { useSpecialistWorkspaceLoader } from "@dude/chat/specialists/hooks/use-specialist-workspace-loader";
import { updateWorkspaceById } from "@dude/workspaces";
import { specialistListPath } from "@dude/workspaces/routes";
import { ProspectChatPanel } from "./components/prospect-chat-panel";
import { LandingPagePreview } from "./components/landing-page-preview";
import { LeadsTable } from "./components/leads-table";
import { AnalyticsPanel } from "./components/analytics-panel";
import type { LandingPage, Lead } from "@dude/specialist-prospect/lib/config";
import { BarChart3, Globe, MessageSquare, Users } from "lucide-react";

type RightTab = "preview" | "contacts" | "analytics";

/**
 * Persisted user messages include the full `[REF]...[/REF]` blocks that were
 * sent to the agent. On reload we strip those out of the visible text and
 * surface them as structured `attachedRefs` so the chat renders pills below
 * the bubble (matching how they appear at send time).
 */
function parseRefsFromMessage(message: string): {
  cleanedMessage: string;
  attachedRefs: Array<{ label: string }>;
} | null {
  const refRe = /\[REF\][\s\S]*?\[\/REF\]\s*/g;
  const blocks = message.match(refRe);
  if (!blocks || blocks.length === 0) return null;

  const attachedRefs = blocks.map((block) => {
    const selectorMatch = block.match(/selector:\s*(.+)/);
    const selector = selectorMatch ? selectorMatch[1].trim() : "element";
    // Last segment of selector is usually the most specific (e.g. "h1.headline").
    const last = selector.split(/\s*>\s*/).pop() || selector;
    return { label: last };
  });
  const cleanedMessage = message.replace(refRe, "").trim();
  return { cleanedMessage, attachedRefs };
}

function isRawSpecialistMessage(value: unknown): value is {
  role: "user" | "assistant";
  message: string;
  date?: string;
  created_at?: string;
} {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    (record.role === "user" || record.role === "assistant") &&
    typeof record.message === "string"
  );
}

export default function ProspectWorkspacePage() {
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pageViews, setPageViews] = useState<Array<{ landingPageId: string; timestamp: string }>>([]);
  const [rightTab, setRightTab] = useState<RightTab>("preview");
  const [mobileView, setMobileView] = useState<"chat" | "right">("chat");
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [agentSending, setAgentSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const selectedPage = landingPages.find((p) => p.id === selectedPageId) || landingPages[0] || null;

  const applyConfig = useCallback((config: Record<string, unknown>) => {
    const legacyLandingPage = config.landingPage;
    const nextLandingPages = Array.isArray(config.landingPages)
      ? (config.landingPages as LandingPage[])
      : legacyLandingPage && typeof legacyLandingPage === "object"
        ? [legacyLandingPage as LandingPage]
        : [];
    setLandingPages(nextLandingPages);
    setLeads((config.leads as Lead[]) || []);
    setPageViews((config.pageViews as Array<{ landingPageId: string; timestamp: string }>) || []);
  }, []);

  const normalizeMessages = useCallback((raw: unknown[]): SpecialistMessage[] => {
    return (Array.isArray(raw) ? raw : [])
      .filter(isRawSpecialistMessage)
      .map((m) => {
        const parsed = m.role === "user" ? parseRefsFromMessage(m.message) : null;
        return {
          message: parsed ? parsed.cleanedMessage : m.message,
          role: m.role,
          date: m.date || m.created_at,
          attachedRefs: parsed?.attachedRefs,
        };
      });
  }, []);

  const {
    workspaceId: rawWorkspaceId,
    workspaceName,
    loading,
    error,
    setError,
    chatMessages: messages,
    setChatMessages: setMessages,
    chatMessagesLoaded: messagesLoaded,
    refreshWorkspace,
    handleRename,
  } = useSpecialistWorkspaceLoader({
    defaultName: "Website",
    applyConfig,
    normalizeMessages,
  });

  const workspaceId = rawWorkspaceId || undefined;

  // Clear stale gateway session when no messages exist after first load
  useEffect(() => {
    if (messagesLoaded && messages.length === 0 && workspaceId) {
      localStorage.removeItem(`prospect-gateway-session:${workspaceId}`);
    }
  }, [messagesLoaded, messages.length, workspaceId]);

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshWorkspace();
    } finally {
      setRefreshing(false);
    }
  }, [refreshWorkspace]);

  const handleDeletePage = useCallback(async (pageId: string) => {
    const updated = landingPages.filter((p) => p.id !== pageId);
    setLandingPages(updated);
    if (selectedPageId === pageId) {
      setSelectedPageId(updated[0]?.id || null);
    }
    try {
      if (workspaceId) {
        await updateWorkspaceById(workspaceId, {
          configurations: { landingPages: updated },
        });
      }
    } catch {
      await refreshWorkspace();
    }
  }, [workspaceId, landingPages, selectedPageId, refreshWorkspace]);

  const handleTogglePublish = useCallback(async (pageId: string, published: boolean) => {
    setPublishLoading(true);
    try {
      const updated = landingPages.map((p) =>
        p.id === pageId ? { ...p, published, updatedAt: new Date().toISOString() } : p,
      );
      setLandingPages(updated);
      if (workspaceId) {
        await updateWorkspaceById(workspaceId, {
          configurations: { landingPages: updated },
        });
      }
    } catch {
      await refreshWorkspace();
    } finally {
      setPublishLoading(false);
    }
  }, [workspaceId, landingPages, refreshWorkspace]);

  // Auto-select first landing page
  useEffect(() => {
    if (!selectedPageId && landingPages.length > 0) {
      setSelectedPageId(landingPages[0].id);
    }
  }, [landingPages, selectedPageId]);

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
        backHref={specialistListPath("prospect")}
        backLabel={"Back to workspaces"}
        onRename={handleRename}
      />

      {/* Mobile view switcher */}
      <div className="flex shrink-0 gap-1 border-b border-border bg-[#f0f0f0] px-3 py-1.5 md:hidden">
        <button
          type="button"
          onClick={() => setMobileView("chat")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            mobileView === "chat"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chat
        </button>
        <button
          type="button"
          onClick={() => setMobileView("right")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            mobileView === "right"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          Preview
        </button>
      </div>

      <SpecialistWorkspaceMain className="flex-row">
        {/* Left — Chat (1/3 on desktop, full-width on mobile when selected) */}
        <div
          className={`${
            mobileView === "chat" ? "flex" : "hidden"
          } w-full min-w-0 flex-col border-r border-border md:flex md:w-1/3`}
        >
          <ProspectChatPanel
            messages={messages}
            setMessages={setMessages}
            messagesLoaded={messagesLoaded}
            onWorkspaceChanged={refreshWorkspace}
            onSendingChange={setAgentSending}
            landingPages={landingPages}
            leads={leads}
            workspaceId={workspaceId}
          />
        </div>

        {/* Right — Preview / Contacts (2/3 on desktop, full-width on mobile when selected) */}
        <div
          className={`${
            mobileView === "right" ? "flex" : "hidden"
          } w-full min-w-0 flex-col overflow-hidden md:flex md:w-2/3`}
        >
          {/* Tab bar */}
          <div className="sticky top-0 z-20 bg-[#f0f0f0] px-4 sm:px-8 py-1.5">
            <nav className="flex gap-1 overflow-x-auto scrollbar-none" aria-label="Tabs">
              <button
                type="button"
                onClick={() => setRightTab("preview")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  rightTab === "preview"
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                {"Landing Page"}
              </button>
              <button
                type="button"
                onClick={() => setRightTab("contacts")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  rightTab === "contacts"
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                {"Contacts"}
                {leads.length > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-primary/10 text-primary text-[10px] font-medium px-1">
                    {leads.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setRightTab("analytics")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  rightTab === "analytics"
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Analytics
              </button>
            </nav>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {rightTab === "preview" && (
              <LandingPagePreview
                landingPages={landingPages}
                selectedPage={selectedPage}
                selectedPageId={selectedPageId}
                onSelectPage={setSelectedPageId}
                onTogglePublish={handleTogglePublish}
                onDeletePage={handleDeletePage}
                publishLoading={publishLoading}
                sending={agentSending}
              />
            )}
            {rightTab === "contacts" && (
              <LeadsTable
                leads={leads}
                landingPages={landingPages}
                selectedPageId={selectedPageId}
                onSelectPage={(id) => {
                  setSelectedPageId(id);
                  setRightTab("preview");
                }}
                onRefresh={handleManualRefresh}
                refreshing={refreshing}
              />
            )}
            {rightTab === "analytics" && (
              <AnalyticsPanel
                landingPages={landingPages}
                leads={leads}
                pageViews={pageViews}
                selectedPageId={selectedPageId}
                onRefresh={handleManualRefresh}
                refreshing={refreshing}
              />
            )}
          </div>
        </div>
      </SpecialistWorkspaceMain>
    </SpecialistWorkspaceFrame>
  );
}
