"use client";

import { useEffect, useState } from "react";
import type { Workspace, WorkspaceTab } from "../types";

export function useTabRouting(mounted: boolean, workspace: Workspace | null) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("chat");
  const [tabInitialized, setTabInitialized] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "");
    if (
      hash === "ingestion" ||
      hash === "data" ||
      hash === "chat" ||
      hash === "reports" ||
      hash === "cleaner" ||
      hash === "settings"
    ) {
      setActiveTab(hash as WorkspaceTab);
      setTabInitialized(true);
      return;
    }
  }, [mounted]);

  // Default to ingestion tab if workspace has no data
  useEffect(() => {
    if (tabInitialized || !workspace) return;
    const tables = Object.keys(workspace.configurations?.schema?.tables ?? {});
    if (tables.length === 0) {
      setActiveTab("ingestion");
    }
    setTabInitialized(true);
  }, [workspace, tabInitialized]);

  useEffect(() => {
    if (!mounted) return;
    if (typeof window === "undefined") return;
    const nextHash = `#${activeTab}`;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, [activeTab, mounted]);

  return { activeTab, setActiveTab };
}
