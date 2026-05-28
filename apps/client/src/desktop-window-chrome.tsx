import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

function readIsDesktopApp() {
  return Boolean(
    typeof window !== "undefined" && window.dudeDesktop?.isDesktop,
  );
}

function readWindowControls() {
  return typeof window !== "undefined"
    ? window.dudeDesktop?.windowControls
    : undefined;
}

export function useIsDesktopApp() {
  const [isDesktop, setIsDesktop] = useState(readIsDesktopApp);

  useEffect(() => {
    if (readIsDesktopApp()) {
      setIsDesktop(true);
      return;
    }

    const id = window.setInterval(() => {
      if (readIsDesktopApp()) {
        setIsDesktop(true);
        window.clearInterval(id);
      }
    }, 50);

    return () => window.clearInterval(id);
  }, []);

  return isDesktop;
}

/**
 * Frameless Electron window controls (macOS-style traffic lights).
 * Portaled to `document.body` so specialist overlays/modals cannot cover it.
 */
export function DesktopWindowChrome() {
  const isDesktop = useIsDesktopApp();
  const [controls, setControls] = useState(readWindowControls);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (controls) return;

    const id = window.setInterval(() => {
      const next = readWindowControls();
      if (next) {
        setControls(next);
        window.clearInterval(id);
      }
    }, 50);

    return () => window.clearInterval(id);
  }, [controls]);

  if (!mounted || !isDesktop || !controls) return null;

  return createPortal(
    <div
      role="banner"
      aria-label="Window controls"
      data-dude-window-chrome=""
      className="dude-desktop-window-chrome fixed inset-x-0 top-0 z-[100000] flex h-9 items-center px-5"
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
    >
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => void controls.close()}
          className="h-3 w-3 rounded-full border border-black/10 bg-[#ff5f57] shadow-sm transition-opacity hover:opacity-80"
        />
        <button
          type="button"
          aria-label="Minimize"
          onClick={() => void controls.minimize()}
          className="h-3 w-3 rounded-full border border-black/10 bg-[#ffbd2e] shadow-sm transition-opacity hover:opacity-80"
        />
        <button
          type="button"
          aria-label="Maximize"
          onClick={() => void controls.maximize()}
          className="h-3 w-3 rounded-full border border-black/10 bg-[#28c840] shadow-sm transition-opacity hover:opacity-80"
        />
      </div>
    </div>,
    document.body,
  );
}
