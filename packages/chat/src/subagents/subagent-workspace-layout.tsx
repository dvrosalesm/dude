import type { ReactNode } from "react";
import { cn } from "@dude/ui/design-system";

/** Root frame for subagent workspace routes — fills the desktop app shell. */
export function SubagentWorkspaceFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-[#f0f0f0]", className)}>
      {children}
    </div>
  );
}

/** Primary split-pane / canvas area below headers and tabs. */
export function SubagentWorkspaceMain({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {children}
    </div>
  );
}

/** Scrollable tab content below fixed workspace chrome. */
export function SubagentWorkspaceScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-auto", className)}>{children}</div>
  );
}

export function SubagentWorkspaceLoading({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 items-center justify-center bg-[#f0f0f0]",
        className,
      )}
    />
  );
}
