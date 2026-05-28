<div align="center">
  <img src="public/assets/logo.png" alt="Dude" width="128" />
</div>

<h1 align="center">Dude</h1>

<p align="center">
  Your local-first AI workspace — everything stays on your machine, and you're in control.
</p>

**Dude** is your main assistant. Need help with data, docs, or design? Specialized helpers (we call them subagents) plug in when you need them, each with their own UI and tools.

Want to go deeper? Check out [docs/](./docs/README.md) for architecture notes, how to build your own subagent, and our [design system](./docs/design.md).

## Before you start

You'll need **Node.js 22.12+** (see `engines` in the root `package.json`).

macOS or Linux works best for desktop dev — if you're on Electron, `better-sqlite3` gets rebuilt automatically on install.

## Get up and running

```bash
npm install

# Web app + backend (runs together — nice and easy)
npm run dev

# Full desktop app (web + backend + Electron window)
npm run desktop:dev

# If you upgraded Electron or hit SQLite weirdness:
npm run rebuild:electron

# Build everything for production
npm run build
```

Once things are running:

| What | Where |
|------|-------|
| App in the browser | http://127.0.0.1:5173 |
| Backend | http://127.0.0.1:8787 |

Not sure if it's alive? Hit `/healthz`, `/v1/health`, or `/api/health` — or run `npm run agent:status` for a quick check.

## How Dude works with helpers

Think of **Dude** as the friendly front desk. You talk to Dude; Dude brings in the right specialist when a job needs it.

Each helper runs in the background (powered by Pi, Codex, Hermes, or Cursor — your choice):

| Who | One runner per… |
|-----|-----------------|
| **Dude** (main assistant) | Your conversation |
| **Subagent** (data, docs, design, etc.) | Workspace |
| **Custom** | Whatever scope you define |

When Dude delegates work, the right helper spins up (or picks up where it left off):

```
You → Dude
        ├─ need charts? → data analyst
        ├─ need a doc? → document writer
        └─ chatting in a workspace → that workspace's helper
```

## What's in the repo

```
dude/
  apps/
    client/              # The UI you see (web + desktop)
    api/                 # Backend — chat, workspaces, AI gateway
  packages/
    sdk/                 # Build your own subagent here
    ui/                  # Shared design system
    chat/                # Chat shell for subagents
    workspaces/          # Workspaces, uploads, assistant stuff
    subagent-*/          # Plug-in helpers (each does one thing well)
    …                    # Lots of shared bits and pieces
  electron/              # Desktop app wrapper
  scripts/               # Handy dev tools
```

### Helpers that ship today

| Package | Good for |
|---------|----------|
| `@dude/subagent-data-analyst` | Charts, SQL, digging into data |
| `@dude/subagent-document-editor` | Editing rich documents |
| `@dude/subagent-document-writer` | Writing structured docs and canvases |
| `@dude/subagent-design-branding` | Brand and design work |

Want to add your own? Register it in `subagents.config.ts` and `subagents.config.client.ts`. Step-by-step guide: [CREATING-A-SUBAGENT.md](./docs/CREATING-A-SUBAGENT.md).

## Try it from the command line

Great for quick smoke tests or when you're working with Cursor agents:

```bash
npm run dev
npm run agent:status

npm run agent -- workspaces create --subagent document-writer --name "Smoke test"
npm run agent -- chat --subagent document-writer --workspace <id> --message "Hello"
```

Full CLI cheat sheet: [scripts/agent-harness/README.md](./scripts/agent-harness/README.md)

Subagent IDs you'll see: `main-assistant`, `data-analyst`, `document-writer`, `presentation-editor`, `design-branding`.

## Build your own helper (subagent)

1. Create `packages/subagent-my-agent/` using `defineSubagent(...)` from `@dude/sdk`
2. Add the package to root `package.json` workspace dependencies
3. Register it in both config files (`subagents.config.ts` + `subagents.config.client.ts`)
4. Put your tools in the package's `gateway/` folder

That's it — welcome to the club.

## Secrets & env (desktop)

For packaged desktop builds, copy [desktop.env.example](./desktop.env.example) to `dude.env` (next to app resources or in Electron userData). Keep real keys out of git!

For local dev, `.env.local` at the repo root works fine (it's gitignored).

## Handy commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the web app + backend |
| `npm run dev:client` | Just the UI |
| `npm run desktop:dev` | Full desktop app |
| `npm run desktop:local` | Desktop app, offline-style |
| `npm run desktop:pack` / `desktop:dist` | Package the desktop app |
| `npm run rebuild:electron` | Fix SQLite for Electron |
| `npm run build` | Build everything |
| `npm run test` | Run tests |
| `npm run lint` | Lint the packages |
| `npm run agent -- <cmd>` | CLI harness for agents |
| `npm run agent:status` | Is everything reachable? |

## Under the hood (if you're curious)

| Layer | What's there |
|-------|--------------|
| UI | Vite, React, Tailwind — fast and familiar |
| Backend | Elysia + SQLite — local and snappy |
| Desktop | Electron — same app, native window |
| AI | Swappable runners (Pi, Codex, Hermes, Cursor) |
| Design | `@dude/ui` — shared components so everything feels cohesive |

---

Questions? Start with [docs/](./docs/README.md) or just run `npm run dev` and poke around — that's the fun part.
