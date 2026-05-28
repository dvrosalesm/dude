"use client";

import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { cn, chatPillClassName } from "@dude/ui/design-system";
import type { ProjectAgentCard, ProjectHubSnapshot } from "@dude/client-types";
import { SPECIALIST_META } from "./specialist-meta";

function formatRelativeTime(iso?: string) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return date.toLocaleDateString();
}

function truncate(text: string, max = 140) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

function AgentCard({
  agent,
  onInstruct,
  onReview,
  onOpen,
}: {
  agent: ProjectAgentCard;
  onInstruct: (agent: ProjectAgentCard) => void;
  onReview: (agent: ProjectAgentCard) => void;
  onOpen: (agent: ProjectAgentCard) => void;
}) {
  const meta = SPECIALIST_META[agent.specialistId];
  const Icon = meta?.icon;
  const preview =
    agent.lastAnswer ||
    agent.recentMessages.find((m) => m.role === "assistant")?.content ||
    agent.lastTask ||
    "No activity yet — instruct this agent to get started.";

  return (
    <article
      className={cn(
        "rounded-xl border border-border/80 bg-[var(--dude-surface-2)]/60 p-4",
        "space-y-3",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            meta?.bg ?? "bg-muted",
          )}
        >
          {Icon ? (
            <Icon className={cn("h-4 w-4", meta?.color ?? "text-foreground")} />
          ) : (
            <Sparkles className="h-4 w-4 text-[var(--dude-accent)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {meta?.label ?? agent.specialistId}
            </h3>
            {agent.lastInvokedAt && (
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(agent.lastInvokedAt)}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{agent.workspaceName}</p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-foreground/80">
        {truncate(preview, 220)}
      </p>

      {agent.artifacts.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {agent.artifacts.slice(0, 4).map((artifact) => (
            <li
              key={artifact.collection}
              className="rounded-full bg-background px-2.5 py-1 text-[11px] text-muted-foreground"
              title={artifact.preview}
            >
              {artifact.label}
              {artifact.count != null ? ` (${artifact.count})` : ""}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onInstruct(agent)}
          className={cn(chatPillClassName(), "gap-1.5 px-3 py-1.5 text-xs")}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Instruct
        </button>
        <button
          type="button"
          onClick={() => onReview(agent)}
          className={cn(chatPillClassName(), "gap-1.5 px-3 py-1.5 text-xs")}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Review
        </button>
        <button
          type="button"
          onClick={() => onOpen(agent)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open workspace
        </button>
      </div>
    </article>
  );
}

export function ProjectHubPanel({
  hub,
  loading,
  onInstruct,
  onReview,
  onOpen,
  onManageProject,
  className,
}: {
  hub: ProjectHubSnapshot | null;
  loading?: boolean;
  onInstruct: (agent: ProjectAgentCard) => void;
  onReview: (agent: ProjectAgentCard) => void;
  onOpen: (agent: ProjectAgentCard) => void;
  onManageProject?: () => void;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const agents = hub?.agents ?? [];
  const hasAgents = agents.length > 0;

  return (
    <section
      className={cn(
        "rounded-2xl border border-border/70 bg-background/80 backdrop-blur-sm",
        className,
      )}
      aria-label="Project workspaces"
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">
            {hub?.projectName?.trim() || "Project workspaces"}
          </p>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Refreshing…"
              : hasAgents
                ? `${agents.length} specialist agent${agents.length === 1 ? "" : "s"} linked`
                : "Delegate to a specialist to link workspaces here"}
          </p>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-border/60 px-4 pb-4 pt-3">
          {!hasAgents && !loading && (
            <div className="rounded-xl bg-[var(--dude-surface-2)] px-4 py-5 text-center text-sm text-muted-foreground">
              Ask Dude to start work with a specialist — linked workspaces and
              their internal agents will show up here for instructions and review.
            </div>
          )}

          {agents.map((agent) => (
            <AgentCard
              key={`${agent.specialistId}:${agent.workspaceId}`}
              agent={agent}
              onInstruct={onInstruct}
              onReview={onReview}
              onOpen={onOpen}
            />
          ))}

          {onManageProject && (
            <button
              type="button"
              onClick={onManageProject}
              className="w-full rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:border-[var(--dude-accent)]/40 hover:text-foreground"
            >
              Ask Dude to manage this project
            </button>
          )}
        </div>
      )}
    </section>
  );
}
