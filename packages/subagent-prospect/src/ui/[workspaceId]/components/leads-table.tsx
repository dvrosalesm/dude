"use client";

import { useMemo, useState } from "react";
import { Download, RefreshCw, Search, Users } from "lucide-react";
import type { LandingPage, Lead } from "@dude/subagent-prospect/lib/config";

interface LeadsTableProps {
  leads: Lead[];
  landingPages: LandingPage[];
  selectedPageId: string | null;
  onSelectPage: (id: string) => void;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
}

export function LeadsTable({
  leads,
  landingPages,
  selectedPageId,
  onSelectPage,
  onRefresh,
  refreshing,
}: LeadsTableProps) {
  const [filterPageId, setFilterPageId] = useState<string | "all">("all");
  const [searchText, setSearchText] = useState("");

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (filterPageId !== "all") {
      result = result.filter((l) => l.landingPageId === filterPageId);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter((l) =>
        Object.values(l.data).some((v) => v.toLowerCase().includes(q)),
      );
    }
    return result.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [leads, filterPageId, searchText]);

  // Compute all unique field names across leads
  const allFieldNames = useMemo(() => {
    const names = new Set<string>();
    for (const lead of leads) {
      for (const key of Object.keys(lead.data)) {
        names.add(key);
      }
    }
    return Array.from(names);
  }, [leads]);

  const handleExportCsv = () => {
    if (filteredLeads.length === 0) return;
    const headers = ["Date", ...allFieldNames];
    const rows = filteredLeads.map((lead) => [
      new Date(lead.createdAt).toLocaleString(),
      ...allFieldNames.map((name) => lead.data[name] || ""),
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="rounded-2xl bg-orange-50 p-4 mb-4">
          <Users className="h-8 w-8 text-orange-400" />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          {"No leads collected yet"}
        </h3>
        <p className="text-xs text-muted-foreground max-w-[280px] mb-4">
          {"Once your landing page is published and visitors submit the form, their information will appear here."}
        </p>
        {onRefresh && (
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-border bg-background flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={"Search leads..."}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {landingPages.length > 1 && (
          <select
            value={filterPageId}
            onChange={(e) => setFilterPageId(e.target.value)}
            className="text-xs bg-muted border border-border rounded-lg px-2 py-2 focus:outline-none"
          >
            <option value="all">All pages</option>
            {landingPages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
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
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filteredLeads.length === 0}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors disabled:opacity-40"
          title="Export CSV"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </button>
      </div>

      {/* Summary */}
      <div className="px-4 py-2 bg-muted/50 border-b border-border">
        <span className="text-xs text-muted-foreground">
          {filteredLeads.length} {filteredLeads.length === 1 ? "lead" : "leads"}
          {filterPageId !== "all" && ` (filtered)`}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b border-border">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">
                Date
              </th>
              {allFieldNames.map((name) => (
                <th
                  key={name}
                  className="text-left px-4 py-2 text-xs font-medium text-muted-foreground capitalize"
                >
                  {name.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(lead.createdAt).toLocaleDateString()}{" "}
                  {new Date(lead.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                {allFieldNames.map((name) => (
                  <td
                    key={name}
                    className="px-4 py-2.5 text-xs text-foreground max-w-[200px] truncate"
                  >
                    {lead.data[name] || (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
