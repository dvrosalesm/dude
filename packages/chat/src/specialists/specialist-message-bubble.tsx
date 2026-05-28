"use client";

import { useState } from "react";
import Link from "@dude/app-navigation/link";
import { specialistListPath } from "@dude/workspaces/routes";
import { ExternalLink, Maximize2, X, Sparkles } from "lucide-react";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import { ChatMarkdown } from "../components/chat/chat-markdown";
import {
  chatAssistantBubbleClassName,
  cn,
} from "@dude/ui/design-system";
import {
  SPECIALIST_META,
  extractImageUrl,
  extractSpecialistAnswer,
} from "./specialist-meta";

export interface SpecialistMessageBubbleProps {
  specialistId: string;
  /** Original message GT sent to the specialist — surfaced in the expanded view. */
  task: string;
  status: "working" | "completed" | "failed";
  steps?: string[];
  result?: unknown;
  onImageClick?: (src: string) => void;
}

/**
 * Renders a specialist hand-off as a secondary speaker in the chat —
 * avatar + flat content, no card frame or pre-title label.
 */
export function SpecialistMessageBubble({
  specialistId,
  task,
  status,
  steps,
  result,
  onImageClick,
}: SpecialistMessageBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = SPECIALIST_META[specialistId];
  if (!meta) return null;

  const SpecIcon = meta.icon;
  const answer = extractSpecialistAnswer(result);
  const imageUrl = extractImageUrl(result);
  const specialistHref = specialistListPath(meta.path);

  const currentStep =
    status === "working" && steps?.length ? steps[steps.length - 1] : null;

  const hasContent = !!answer || !!imageUrl;

  return (
    <>
      <div className="flex items-start gap-2.5 max-w-[85%]">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.bg} mt-0.5`}
          aria-hidden
        >
          <SpecIcon className={`h-3.5 w-3.5 ${meta.color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn(chatAssistantBubbleClassName(), "space-y-2")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm font-semibold ${meta.color}`}>
                {meta.label}
              </span>
              {status === "working" && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <BrailleSpinner className="text-[9px]" />
                  Working…
                </span>
              )}
              {status === "failed" && (
                <span className="text-xs text-destructive">Failed</span>
              )}
            </div>

            {status === "working" && (
              <div className="space-y-1.5">
                {currentStep ? (
                  <p className="text-foreground/80 leading-relaxed">{currentStep}</p>
                ) : (
                  <p className="text-muted-foreground italic">
                    Looking at this for you…
                  </p>
                )}
              </div>
            )}

            {status === "completed" && (
              <>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => onImageClick?.(imageUrl)}
                    className="block overflow-hidden rounded-xl hover:opacity-90 transition-opacity cursor-zoom-in"
                  >
                    <img
                      src={imageUrl}
                      alt=""
                      className="max-h-64 w-auto object-contain rounded-xl"
                    />
                  </button>
                )}
                {answer ? (
                  <div className="prose prose-sm max-w-none text-foreground/90 leading-relaxed">
                    <ChatMarkdown content={answer} />
                  </div>
                ) : !imageUrl ? (
                  <p className="text-sm text-muted-foreground italic">
                    Done — no text response.
                  </p>
                ) : null}
              </>
            )}

            {status === "failed" && (
              <p className="text-sm text-destructive/90">
                Something went wrong while running this specialist. Try again or
                open the workspace to investigate.
              </p>
            )}
          </div>

          {status === "completed" && (hasContent || specialistHref) && (
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              {hasContent && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <Maximize2 className="h-3 w-3" />
                  View details
                </button>
              )}
              {specialistHref && (
                <Link
                  href={specialistHref}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open in {meta.label}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden bg-background mx-4 rounded-2xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-2.5 px-5 py-4">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.bg}`}
              >
                <SpecIcon className={`h-3.5 w-3.5 ${meta.color}`} />
              </div>
              <span className="flex-1 min-w-0 text-sm font-semibold">{meta.label}</span>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              <section className="pb-6">
                <h3 className="mb-2 text-sm font-semibold text-foreground">Task</h3>
                <p className="text-sm leading-relaxed text-foreground/70">
                  {task || "(no task recorded)"}
                </p>
              </section>

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--dude-accent)]" />
                  Result
                </h3>

                {imageUrl && (
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setExpanded(false);
                        onImageClick?.(imageUrl);
                      }}
                      className="block overflow-hidden rounded-xl hover:opacity-90 transition-opacity cursor-zoom-in"
                    >
                      <img
                        src={imageUrl}
                        alt=""
                        className="max-h-72 w-auto object-contain"
                      />
                    </button>
                  </div>
                )}

                {answer ? (
                  <div className="text-sm leading-relaxed text-foreground/80 prose prose-sm max-w-none">
                    <ChatMarkdown content={answer} />
                  </div>
                ) : result ? (
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/70">
                    {typeof result === "string"
                      ? result
                      : JSON.stringify(result, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    No result details available.
                  </p>
                )}
              </section>
            </div>

            {specialistHref && (
              <div className="shrink-0 px-5 py-4">
                <Link
                  href={specialistHref}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.color} hover:underline`}
                >
                  Open in {meta.label}
                  <span aria-hidden>→</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
