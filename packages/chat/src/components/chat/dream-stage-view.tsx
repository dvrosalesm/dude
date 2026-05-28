"use client";

import type { ReactNode } from "react";
import { BrailleSpinner } from "@dude/ui/components/braille-spinner";
import { cn } from "@dude/ui/design-system";

export function DreamThinkingStage({
  question,
  statusLabel,
  className,
}: {
  question: string;
  statusLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "dream-thinking-stage flex w-full flex-col items-center justify-center px-6 py-8 text-center",
        className,
      )}
      data-dream-phase="thinking"
    >
      <h2 className="dude-think-question-text max-w-2xl text-balance text-center">
        {question}
      </h2>
      <div className="mt-8 flex items-center gap-2.5 text-sm text-muted-foreground">
        <BrailleSpinner className="text-base" />
        <span>{statusLabel || "Thinking…"}</span>
      </div>
    </div>
  );
}

export function DreamAnswerStage({
  children,
  revealing,
  className,
}: {
  children: ReactNode;
  revealing?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "dream-answer-stage w-full",
        revealing && "dream-answer-stage--revealing",
        className,
      )}
    >
      {children}
    </div>
  );
}
