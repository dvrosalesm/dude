"use client";

import type { WorkspaceTab } from "../types";
import { Database, MessageSquare, FileText, Upload } from "lucide-react";

type WorkspaceTabsProps = {
  activeTab: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
};

const TAB_ICONS: Record<WorkspaceTab, React.ComponentType<{ className?: string }>> = {
  ingestion: Upload,
  data: Database,
  chat: MessageSquare,
  reports: FileText,
};

export function WorkspaceTabs({ activeTab, onChange }: WorkspaceTabsProps) {
  const tabs: Array<{ value: WorkspaceTab; label: string }> = [
    { value: "ingestion", label: "Data ingestion" },
    { value: "data", label: "Data" },
    { value: "chat", label: "Chat with data" },
    { value: "reports", label: "Reports" },
  ];

  return (
    <div className="sticky top-[44px] z-20 bg-[#f0f0f0] px-4 sm:px-8 py-1.5">
      <nav className="flex gap-1 overflow-x-auto scrollbar-none" aria-label="Tabs">
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab.value];
          const active = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onChange(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
