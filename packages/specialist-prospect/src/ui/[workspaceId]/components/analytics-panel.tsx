"use client";

import { useMemo } from "react";
import { Eye, RefreshCw, TrendingUp, UserPlus } from "lucide-react";
import type { LandingPage, Lead } from "@dude/specialist-prospect/lib/config";

interface PageView {
  landingPageId: string;
  timestamp: string;
}

interface AnalyticsPanelProps {
  landingPages: LandingPage[];
  leads: Lead[];
  pageViews: PageView[];
  selectedPageId: string | null;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function groupByDay(items: Array<{ timestamp: string }>): Record<string, number> {
  const groups: Record<string, number> = {};
  for (const item of items) {
    const day = item.timestamp.slice(0, 10);
    groups[day] = (groups[day] || 0) + 1;
  }
  return groups;
}

function MiniBarChart({ data, label }: { data: Record<string, number>; label: string }) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  if (entries.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-6">
        No {label.toLowerCase()} data yet
      </div>
    );
  }
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-3">{label} (last 14 days)</p>
      <div className="flex items-end gap-1 h-24">
        {entries.map(([day, count]) => (
          <div key={day} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-primary/20 hover:bg-primary/40 transition-colors min-h-[2px]"
              style={{ height: `${(count / max) * 100}%` }}
              title={`${day}: ${count}`}
            />
            <span className="text-[9px] text-muted-foreground -rotate-45 origin-top-left whitespace-nowrap">
              {day.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPanel({
  landingPages,
  leads,
  pageViews,
  selectedPageId,
  onRefresh,
  refreshing,
}: AnalyticsPanelProps) {
  const filteredViews = useMemo(
    () =>
      selectedPageId
        ? pageViews.filter((v) => v.landingPageId === selectedPageId)
        : pageViews,
    [pageViews, selectedPageId],
  );

  const filteredLeads = useMemo(
    () =>
      selectedPageId
        ? leads.filter((l) => l.landingPageId === selectedPageId)
        : leads,
    [leads, selectedPageId],
  );

  const conversionRate = useMemo(() => {
    if (filteredViews.length === 0) return "0%";
    return ((filteredLeads.length / filteredViews.length) * 100).toFixed(1) + "%";
  }, [filteredViews.length, filteredLeads.length]);

  const viewsByDay = useMemo(() => groupByDay(filteredViews), [filteredViews]);
  const leadsByDay = useMemo(
    () => groupByDay(filteredLeads.map((l) => ({ timestamp: l.createdAt }))),
    [filteredLeads],
  );

  const selectedTitle = landingPages.find((p) => p.id === selectedPageId)?.title;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        {selectedTitle ? (
          <p className="text-xs text-muted-foreground">
            Showing stats for <span className="font-medium text-foreground">{selectedTitle}</span>
          </p>
        ) : (
          <span />
        )}
        {onRefresh && (
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={refreshing}
            className="shrink-0 flex items-center justify-center p-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={Eye}
          label="Page Views"
          value={filteredViews.length}
          sub={filteredViews.length > 0
            ? `Since ${filteredViews[0].timestamp.slice(0, 10)}`
            : undefined}
        />
        <StatCard
          icon={UserPlus}
          label="Leads"
          value={filteredLeads.length}
        />
        <StatCard
          icon={TrendingUp}
          label="Conversion"
          value={conversionRate}
          sub={filteredViews.length > 0 ? `${filteredLeads.length} / ${filteredViews.length}` : undefined}
        />
      </div>

      <div className="rounded-xl border border-border bg-background p-4">
        <MiniBarChart data={viewsByDay} label="Page Views" />
      </div>

      <div className="rounded-xl border border-border bg-background p-4">
        <MiniBarChart data={leadsByDay} label="Leads Captured" />
      </div>
    </div>
  );
}
