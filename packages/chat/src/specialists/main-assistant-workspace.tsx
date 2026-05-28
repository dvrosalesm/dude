"use client";

import { ChevronRight } from "lucide-react";
import { chatPillClassName, cn } from "@dude/ui/design-system";
import { SPECIALIST_META } from "./specialist-meta";

export type WorkspaceSpecialist = {
  id: string;
  name: string;
  scope: string;
};

const STARTER_PROMPTS = [
  "What can you and my specialists help me with today?",
  "I have data to analyze — point me to the right workspace",
  "Draft a quick plan for something I'm working on",
  "Open my most recent specialist workspace",
];

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function MainAssistantHome({
  assistantName,
  specialists,
  pinnedSnippets = [],
  onStarterPrompt,
  onSpecialistClick,
  onShowPinned,
}: {
  assistantName: string;
  specialists: WorkspaceSpecialist[];
  pinnedSnippets?: Array<{ id: string; preview: string }>;
  onStarterPrompt: (prompt: string) => void;
  onSpecialistClick: (specialistId: string) => void;
  onShowPinned?: () => void;
}) {
  const greeting = timeGreeting();
  const visibleSpecialists = specialists.slice(0, 5);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-10 px-2 py-6 text-center">
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          {greeting}.
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{assistantName}</span>{" "}
          routes work to your specialists — or handles it directly when you ask.
        </p>
      </div>

      {pinnedSnippets.length > 0 && (
        <div className="w-full space-y-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">Saved from earlier</p>
            {onShowPinned && (
              <button
                type="button"
                onClick={onShowPinned}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
              </button>
            )}
          </div>
          <ul className="space-y-2">
            {pinnedSnippets.slice(0, 3).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onStarterPrompt(`Continue from: ${item.preview}`)}
                  className="flex w-full items-center gap-2 rounded-xl bg-[var(--dude-surface-2)] px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-[var(--dude-accent-soft)]"
                >
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="line-clamp-2">{item.preview}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {visibleSpecialists.length > 0 && (
        <div className="w-full space-y-3">
          <p className="text-sm font-medium text-foreground">Your specialists</p>
          <div className="flex flex-wrap justify-center gap-2">
            {visibleSpecialists.map((specialist) => {
              const meta = SPECIALIST_META[specialist.id];
              const Icon = meta?.icon;
              return (
                <button
                  key={specialist.id}
                  type="button"
                  onClick={() => onSpecialistClick(specialist.id)}
                  className={cn(
                    chatPillClassName(),
                    "gap-2 px-4 py-2 text-sm text-foreground",
                  )}
                  title={specialist.scope}
                >
                  {Icon && <Icon className="h-3.5 w-3.5 text-[var(--dude-accent)]" />}
                  {specialist.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="w-full space-y-3">
        <p className="text-sm font-medium text-foreground">Start here</p>
        <div className="flex flex-col gap-2">
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onStarterPrompt(prompt)}
              className="rounded-xl bg-[var(--dude-surface-2)] px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-[var(--dude-accent-soft)]"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export type MessageTurn = {
  user: import("./types").SpecialistMessage | null;
  userIndex: number;
  replies: Array<{ message: import("./types").SpecialistMessage; index: number }>;
};

export function groupMessageTurns(
  messages: import("./types").SpecialistMessage[],
): MessageTurn[] {
  const turns: MessageTurn[] = [];
  let current: MessageTurn | null = null;

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.hidden) continue;

    if (message.role === "user") {
      current = { user: message, userIndex: index, replies: [] };
      turns.push(current);
      continue;
    }

    if (!current) {
      current = { user: null, userIndex: -1, replies: [] };
      turns.push(current);
    }
    current.replies.push({ message, index });
  }

  return turns;
}

export function turnPreviewText(turn: MessageTurn): string {
  const raw = turn.user?.message ?? turn.user?.answer;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().replace(/\s+/g, " ");
  }
  const firstReply = turn.replies[0]?.message;
  const replyRaw = firstReply?.answer ?? firstReply?.message;
  if (typeof replyRaw === "string" && replyRaw.trim()) {
    return replyRaw.trim().replace(/\s+/g, " ").slice(0, 120);
  }
  return "Earlier exchange";
}
