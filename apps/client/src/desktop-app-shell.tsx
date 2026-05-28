import type { ReactNode, CSSProperties } from "react";
import { cn } from "@dude/ui/design-system";
import { useIsDesktopApp } from "./desktop-window-chrome";

export function DesktopAppShell({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktopApp();

  return (
    <div
      className="dude-dream-bg fixed inset-0 z-50 flex h-[100dvh] w-full overflow-hidden text-foreground"
      data-dude-desktop-app={isDesktop || undefined}
      style={
        isDesktop
          ? ({ "--dude-desktop-chrome-height": "2.25rem" } as CSSProperties)
          : undefined
      }
    >
      <div
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          isDesktop && "pt-9",
        )}
      >
        {children}
      </div>
    </div>
  );
}
