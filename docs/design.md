# Dude Design System

Human-facing overview of how Dude looks and behaves. **Source of truth in code:** `packages/ui/src/lib/design-system/` (`theme.ts`, `tokens.ts`, `patterns.ts`) and `apps/client/src/styles/globals.css`.

## Design intent

Dude is a **local-first agent workspace**, not a marketing site. The UI should feel calm, capable, and work-focused: chat at the center, specialists as extensions of conversation, local runtime state visible but restrained.

Avoid loud gradients, neon dashboards, generic SaaS chrome, card grids, and heavy boxed layouts.

## Visual principles

1. **Clarity over cleverness** — Obvious labels, predictable hierarchy, direct CTAs.
2. **Cool bone white** — Light blue-white canvas (`#FAFCFE`), soft sky accent (`#4F7394`), not warm gold as the primary UI chrome.
3. **Flat layout** — No cards, dividers, or pre-titles; separate sections with spacing and background tints (`DESIGN_BANS` in `tokens.ts`).
4. **Dreamy, not fluffy** — Subtle dot pattern (`.dude-dream-bg`), ambient glow, glassy floating chrome; no mascot clutter.
5. **Chat is the center** — Main assistant home, docked input, specialist workspaces branch from chat routes.
6. **Low color, high meaning** — Map specialist icons, chips, and charts to `--dude-accent` / `--dude-muted`; do not invent per-specialist palette colors.

## Theme

The app ships **one theme** today: `bone` (light). Applied via `applyDudeTheme()` in `theme.ts` — `data-dude-theme="bone"`, no `dark` class.

| Token | Value | Usage |
| --- | --- | --- |
| `--dude-bg` | `#FAFCFE` | App canvas, full-height shells |
| `--dude-surface` | `#FFFFFF` | Panels, elevated areas |
| `--dude-surface-2` | `#F2F6FA` | Inputs, chips, hover wells |
| `--dude-line` | `#E2EAF2` | Borders, outlines |
| `--dude-text` | `#1A1A1A` | Primary copy |
| `--dude-muted` | `#6B7280` | Secondary copy, hints |
| `--dude-accent` | `#4F7394` | Actions, active icons, focus |
| `--dude-accent-soft` | `rgb(79 115 148 / 0.08)` | Tinted accent backgrounds |
| `--dude-text-soft` | `rgb(26 26 26 / 0.03)` | Floating chrome (e.g. specialist header pill) |
| `--dude-glow` | `#B8D4EB` | Ambient radial glow on `.dude-dream-bg::before` |
| `--dude-success` | `#3D8B63` | Healthy local / gateway state |
| `--dude-danger` | `#C45C4D` | Errors, destructive actions |

Legacy aliases still used in some screens: `--dude-pearl` (primary text on patterned pages), `--dude-fog` (muted on directory lists). Prefer `--dude-text` / `--dude-muted` in new code.

shadcn semantic tokens (`--background`, `--primary`, `--secondary`, etc.) are aligned to the same cool palette in `theme.ts` / `globals.css`.

## Background pattern

```css
.dude-dream-bg {
  background-color: var(--dude-bg);
  background-image: var(--dude-pattern);
  background-size: 28px 28px, 44px 44px;
}
```

Use on app shell, specialist directory, and loading states. Keep pattern subtle behind dense chat text; main assistant chat can use a transparent stage over the shell pattern.

## Typography

| Stack | Fonts |
| --- | --- |
| Sans | Plus Jakarta Sans, system UI |
| Mono | System ui-monospace stack |
| Scribble input | Caveat (main assistant open input + thinking question only) |

Scale (Tailwind): preferences titles `text-3xl`, chat chrome `text-base` semibold, body `text-sm`, hints `text-xs` + `--dude-muted`. Use mono for ports, paths, API keys, runtime labels.

## Shape and spacing

- Base radius: `--radius` = `0.875rem` (14px).
- Chat bubbles: `rounded-2xl` (~18px).
- Controls: `rounded-lg` / `rounded-md`.
- Spacing: 4px grid via Tailwind (`p-2`, `p-4`, `p-6`, etc.).

## App shell and navigation

There is **no persistent left org sidebar**. Navigation is chat-centric:

| Route | Shell |
| --- | --- |
| `/chat` | Main assistant: `AgentBlob` header, centered stage chat, docked input (`max-w-3xl`) |
| `/chat` | Hover **right strip** (`SpecialistsSidebar`): specialists, pinned filter, gallery, preferences, new conversation |
| `/chat/preferences` | Full-page preferences (`PreferencesView`), scrollable sections |
| `/chat/specialists` | Specialists directory (row list on `dude-dream-bg`) |
| `/chat/specialists/:kind` | Workspace list per specialist |
| `/chat/specialists/:kind/:workspaceId` | Specialist workspace UI |

Desktop Electron adds top window chrome (`DesktopWindowChrome`, 36px) via `--dude-desktop-chrome-height`.

Specialist packages may use **workspace panels** (slide list, design inspector, data tables) — those are tool surfaces inside a workspace, not app-level navigation.

## Components

### Primary button

- Background: `--dude-accent`
- Text: on-accent contrast (often `--dude-bg` or white)
- Hover: opacity ~90%, no scale bounce

### Secondary / ghost

- Hover: `--dude-surface-2` or `secondary/60`
- Avoid bordered card wrappers

### Chat

- Main assistant: `historyLayout="stage"`, transparent shell, `inputVariant="open"` with Caveat placeholder style
- Specialist chats: `historyLayout="bubbles"`, `--dude-bg` fill, compact top chrome with back affordance
- User/assistant bubbles: `--dude-surface-2` / accent-soft tints; pinned and tool rows use `--dude-accent-soft`

### Input bar

Docked bottom, rounded, low-contrast border; attachments as compact rows above the field. Main assistant input is a primary brand surface (open/scribble variant).

### Settings / preferences

Full-page scroll, section titles, inline rows — **no section sidebar**, no horizontal rules between rows. Use whitespace and hover surfaces (`runner-settings-panel` patterns).

### Status

Compact labels; healthy `--dude-success`, errors `--dude-danger`. Mono for `LOCAL`, gateway, provider IDs. Avoid pill badges.

## Motion

- Micro: 100–150ms (hover, focus)
- State: 200–300ms (e.g. specialist hover strip fade)
- Layout: 300–500ms (route-level if animated)
- Respect `prefers-reduced-motion` (see `globals.css` dream-phase animations)

## Do

- Use `@dude/ui` tokens and `cn()` from `@dude/ui/design-system`
- Keep chat and local runtime state central
- Use `.dude-dream-bg` for full-page specialist/directory shells
- Show gateway, API keys, and storage honestly in preferences copy

## Do not

- Add cards, dividers, or eyebrow pre-titles (`DESIGN_BANS`)
- Introduce per-specialist brand colors in the shell
- Document or build a shadcn `SidebarProvider` org layout (removed)
- Treat this file as the runtime token source — change `theme.ts` / `globals.css` first

## Product voice

Short, warm, direct — specify what is local, what needs an API key, and what costs tokens.

> Gateway is ready. Add an OpenRouter key to run the assistant, or switch to a local Ollama model.

Not:

> Unlock the power of AI with our next-generation productivity platform.

## Related (not this doc)

- **Per-presentation `design.md`** — Created by the document-editor specialist (`manage_design`) for slide HTML; workspace data, not this file.
- **Slide theme presets** — `packages/presentation-editor/.../design-styles/*.md` (bauhaus, editorial, etc.).
