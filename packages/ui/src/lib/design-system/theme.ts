/** Dude ships one theme for now — faint cool blue over white, not warm yellow. */
export type DudeThemeMode = "bone";

export const BONE_THEME_VARIABLES: Record<string, string> = {
  "--dude-bg": "#FAFCFE",
  "--dude-surface": "#FFFFFF",
  "--dude-surface-2": "#F2F6FA",
  "--dude-line": "#E2EAF2",
  "--dude-text": "#1A1A1A",
  "--dude-muted": "#6B7280",
  "--dude-accent": "#4F7394",
  "--dude-accent-soft": "rgb(79 115 148 / 0.08)",
  "--dude-glow": "#B8D4EB",
  "--dude-success": "#3D8B63",
  "--dude-danger": "#C45C4D",
  "--dude-mascot-amber": "#8BB8DC",
  "--dude-mascot-peach": "#7BA8D4",
  "--dude-mascot-teal": "#6BC5A0",
  "--dude-mascot-sky": "#5BA3C9",
  "--dude-mascot-violet": "#94B8E8",
  "--dude-text-soft": "rgb(26 26 26 / 0.03)",
  "--dude-night": "#FAFCFE",
  "--dude-deep-ink": "#FFFFFF",
  "--dude-charcoal": "#FFFFFF",
  "--dude-smoke": "#F2F6FA",
  "--dude-fog": "#6B7280",
  "--dude-pearl": "#1A1A1A",
  "--dude-pattern":
    "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--dude-line) 8%, transparent) 1px, transparent 0), linear-gradient(135deg, color-mix(in srgb, var(--dude-line) 4%, transparent) 1px, transparent 1px)",
  "--font-sans":
    '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "--font-mono":
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  "--radius": "0.875rem",
  "--background": "210 40% 99%",
  "--foreground": "220 15% 12%",
  "--card": "0 0% 100%",
  "--card-foreground": "220 15% 12%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "220 15% 12%",
  "--secondary": "210 35% 96%",
  "--secondary-foreground": "220 15% 12%",
  "--muted": "210 30% 98%",
  "--muted-foreground": "220 8% 46%",
  "--border": "210 22% 90%",
  "--input": "210 22% 90%",
  "--primary": "210 35% 28%",
  "--primary-foreground": "0 0% 100%",
  "--accent": "210 35% 96%",
  "--accent-foreground": "220 15% 12%",
  "--destructive": "8 48% 54%",
  "--destructive-foreground": "0 0% 100%",
  "--ring": "210 35% 28%",
  "--chart-1": "210 35% 28%",
  "--chart-2": "152 30% 40%",
  "--chart-3": "210 35% 28%",
  "--chart-4": "210 35% 28%",
  "--chart-5": "220 8% 46%",
  "--sidebar-primary": "210 35% 28%",
  "--sidebar-ring": "210 35% 28%",
};

export function applyDudeTheme(_theme: DudeThemeMode = "bone") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.dudeTheme = "bone";
  root.classList.remove("dark");
  for (const [name, value] of Object.entries(BONE_THEME_VARIABLES)) {
    root.style.setProperty(name, value);
  }
}
