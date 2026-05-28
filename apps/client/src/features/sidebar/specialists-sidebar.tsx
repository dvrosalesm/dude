import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, Pin, Settings, Trash2 } from "lucide-react";
import { cn } from "@dude/ui/design-system";
import { navigateTo, specialistPath } from "../../route-utils";
import type { SpecialistSummary } from "../../types";
import { getSpecialistIcon, isKnownSpecialist } from "../shell/specialist-icons";

export function SpecialistsSidebar({
  specialists,
  showPinnedOnly,
  onTogglePinnedOnly,
  onShowGallery,
  onNewConversation,
  onOpenPreferences,
}: {
  specialists: SpecialistSummary[];
  showPinnedOnly: boolean;
  onTogglePinnedOnly: () => void;
  onShowGallery: () => void;
  onNewConversation: () => void;
  onOpenPreferences: () => void;
}) {
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleSpecialists = useMemo(
    () => specialists.filter(isKnownSpecialist),
    [specialists],
  );

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearCloseTimeout();
    setOpen(false);
  }, [clearCloseTimeout]);

  const handleOpen = useCallback(() => {
    clearCloseTimeout();
    setOpen(true);
  }, [clearCloseTimeout]);

  const scheduleClose = useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setOpen(false);
      closeTimeoutRef.current = null;
    }, 280);
  }, [clearCloseTimeout]);

  useEffect(() => {
    return () => clearCloseTimeout();
  }, [clearCloseTimeout]);

  return (
    <>
      <div
        className="fixed inset-y-0 right-0 z-50 w-6"
        aria-hidden
        onMouseEnter={handleOpen}
        onMouseLeave={scheduleClose}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-[11rem] overflow-hidden",
          !open && "pointer-events-none",
        )}
        onMouseEnter={handleOpen}
        onMouseLeave={scheduleClose}
      >
        <aside
          className={cn(
            "flex h-full w-full flex-col items-end text-right",
            "transition-opacity duration-300 ease-out",
            open ? "opacity-100" : "opacity-0",
          )}
          aria-label="Specialists"
          aria-hidden={!open}
        >
        <div className="min-h-0 w-full flex-1 overflow-y-auto px-2 pb-2 pr-4 pt-6">
          <ul className="space-y-0.5">
            {visibleSpecialists.map((specialist) => {
              const Icon = getSpecialistIcon(specialist.id);
              const href = specialistPath(specialist.id);

              return (
                <li key={specialist.id}>
                  <a
                    href={href}
                    title={specialist.scope}
                    onClick={(event) => {
                      event.preventDefault();
                      close();
                      navigateTo(href);
                    }}
                    className="flex flex-row-reverse items-center gap-2 rounded-lg px-2 py-1.5 text-right transition-colors hover:bg-secondary/60"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <Icon className="h-3.5 w-3.5 text-[var(--dude-accent)]" />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                      {specialist.name}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="w-full p-2 pr-4">
          <ul className="space-y-0.5">
            <li>
              <button
                type="button"
                onClick={onTogglePinnedOnly}
                className="flex w-full flex-row-reverse items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary/60"
              >
                <Pin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {showPinnedOnly ? "Show all messages" : "Pinned only"}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  close();
                  onShowGallery();
                }}
                className="flex w-full flex-row-reverse items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary/60"
              >
                <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                Images
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  close();
                  onOpenPreferences();
                }}
                className="flex w-full flex-row-reverse items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary/60"
              >
                <Settings className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                Preferences
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  close();
                  onNewConversation();
                }}
                className="flex w-full flex-row-reverse items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                New conversation
              </button>
            </li>
          </ul>
        </div>
      </aside>
      </div>
    </>
  );
}

