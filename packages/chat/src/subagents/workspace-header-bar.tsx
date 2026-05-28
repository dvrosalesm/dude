"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@dude/app-navigation/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { useIsEmbedded } from "@dude/subagent-params";

type WorkspaceHeaderBarProps = {
  title: string;
  messageCount?: number;
  backHref: string;
  backLabel: string;
  actions?: React.ReactNode;
  onRename?: (name: string) => void;
};

export function WorkspaceHeaderBar({
  title,
  backHref,
  backLabel,
  actions,
  onRename,
}: WorkspaceHeaderBarProps) {
  const isEmbedded = useIsEmbedded();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      setDraft(title);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [renaming, title]);

  const commitRename = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) {
      onRename?.(trimmed);
    }
    setRenaming(false);
  }, [draft, title, onRename]);

  return (
    <div className="sticky top-0 z-30 relative flex items-center justify-center bg-[#f0f0f0] px-2 sm:px-4 py-2.5 shrink-0">
      {!isEmbedded && (
        <div className="absolute left-2 sm:left-4">
          <Link
            href={backHref}
            aria-label={backLabel}
            className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      )}
      <div className="text-center min-w-0 px-10 sm:px-12 w-full">
        {renaming ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            className="text-sm font-medium text-foreground text-center bg-black/5 rounded-md px-2 py-0.5 outline-none w-full max-w-[12rem]"
          />
        ) : (
          <button
            type="button"
            onClick={() => onRename && setRenaming(true)}
            className="group inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-foreground truncate sm:max-w-[250px]"
            title={title}
          >
            <span className="truncate">{title}</span>
            {onRename && (
              <Pencil className="h-3 w-3 shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
            )}
          </button>
        )}
      </div>
      {actions ? (
        <div className="absolute right-2 sm:right-4 flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
