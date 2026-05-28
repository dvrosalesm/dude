/**
 * Reusable layout + form patterns for status-aware / AI-generated UI.
 */

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Floating top-right chrome button (settings, subagents). */
export function chromeButtonClassName(active = false) {
  return cn(
    "inline-flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-xl transition-colors",
    active
      ? "bg-[var(--dude-accent-soft)] text-[var(--dude-text)]"
      : "bg-background/80 text-muted-foreground hover:bg-secondary hover:text-foreground",
  );
}

/** Preferences sidebar nav item. */
export function prefsNavItemClassName(active: boolean) {
  return cn(
    "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors",
    active
      ? "bg-[var(--dude-surface-2)] text-[var(--dude-text)]"
      : "text-[var(--dude-muted)] hover:bg-[var(--dude-surface-2)] hover:text-[var(--dude-text)]",
  );
}

/** Standard text input in preferences / config panels. */
export function fieldInputClassName() {
  return "h-9 w-full rounded-lg border border-transparent bg-transparent px-2.5 text-sm text-[var(--dude-text)] outline-none transition-colors placeholder:text-[var(--dude-muted)] focus:border-[var(--dude-line)] focus:bg-[var(--dude-surface-2)]";
}

/** Mono input for paths, API keys, CLI bins. */
export function fieldMonoInputClassName() {
  return cn(fieldInputClassName(), "font-mono");
}

/** Select in config panels. */
export function fieldSelectClassName() {
  return "h-9 w-full rounded-lg border border-transparent bg-[var(--dude-surface-2)] px-2.5 text-sm text-[var(--dude-text)] outline-none transition-colors focus:border-[var(--dude-line)]";
}

/** Flat content block — spacing only, never a bordered card. */
export function stackBlockClassName() {
  return "py-4";
}

/** Vertical rhythm between major blocks. */
export function stackGroupClassName() {
  return "space-y-8";
}

/** Page-level heading (one title, no eyebrow above it). */
export function pageTitleClassName() {
  return "mb-8 text-3xl font-semibold tracking-tight text-[var(--dude-text)]";
}

/** In-page section heading. */
export function sectionHeadingClassName() {
  return "mb-4 text-lg font-semibold tracking-tight text-[var(--dude-text)]";
}

/** User message — tinted block, no border. */
export function chatUserBubbleClassName(wide = false) {
  return cn(
    wide ? "max-w-[90%]" : "max-w-[75%]",
    "rounded-2xl bg-[var(--dude-surface-2)] px-4 py-3 text-sm text-[var(--dude-text)]",
  );
}

/** Assistant message — plain text flow, no card frame. */
export function chatAssistantBubbleClassName(wide = false, pinned = false) {
  return cn(
    wide ? "max-w-[90%] w-full" : "max-w-[75%]",
    "text-sm leading-relaxed text-[var(--dude-text)]",
    pinned && "rounded-2xl bg-[var(--dude-accent-soft)] px-4 py-3",
  );
}

/** Composer shell — no border card. */
export function chatInputShellClassName(dragOver = false) {
  return cn(
    "rounded-2xl bg-[var(--dude-surface-2)] transition-colors",
    dragOver && "bg-[var(--dude-accent-soft)]",
  );
}

/** Suggestion / action pill — background only. */
export function chatPillClassName(active = false) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors",
    active
      ? "bg-[var(--dude-accent-soft)] text-[var(--dude-accent)]"
      : "bg-[var(--dude-surface-2)] text-[var(--dude-muted)] hover:bg-[var(--dude-accent-soft)] hover:text-[var(--dude-text)]",
  );
}

/** Attachment reference pill in messages or composer. */
export function chatAttachmentPillClassName() {
  return "inline-flex items-center gap-2 rounded-full bg-[var(--dude-surface-2)] py-1 pl-1 pr-3 text-[11px] text-[var(--dude-muted)] transition-colors hover:text-[var(--dude-text)]";
}

/** Main assistant — current user prompt (editorial, not a bubble). */
export function chatWorkspacePromptClassName() {
  return "mx-auto w-full max-w-2xl text-center text-xl font-semibold tracking-tight text-balance text-[var(--dude-text)]";
}

/** Main assistant — assistant reply in workspace layout. */
export function chatWorkspaceResponseClassName(pinned = false) {
  return cn(
    "mx-auto w-full max-w-2xl text-sm leading-relaxed text-[var(--dude-text)]",
    pinned && "rounded-2xl bg-[var(--dude-accent-soft)] px-4 py-3",
  );
}

/** Collapsed earlier turn in workspace history. */
export function chatWorkspaceEarlierTurnClassName() {
  return "mx-auto flex w-full max-w-2xl items-center gap-2 py-2.5 text-left text-sm text-[var(--dude-muted)] transition-colors hover:text-[var(--dude-text)]";
}
