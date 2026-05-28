# Dude

![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Elysia](https://img.shields.io/badge/Elysia-1-3B82F6)
![Electron](https://img.shields.io/badge/Electron-42-47848F?logo=electron&logoColor=white)
![License](https://img.shields.io/badge/License-Proprietary-FBB76B)

Local-first AI workspace. **Dude** is the main assistant orchestrator; each domain agent is an installable `@dude/specialist-*` package with its own UI and gateway tools.

More docs: [docs/](./docs/README.md) — architecture, specialist authoring, [design system](./docs/design.md).

## Prerequisites

- **Node.js** `>=22.12.0` (see `engines` in root `package.json`)
- macOS/Linux recommended for desktop dev (`better-sqlite3` is rebuilt for Electron on `postinstall`)

## Quick start

```bash
npm install

# Vite client + unified Elysia API (API runs under Electron's Node for SQLite parity)
npm run dev

# Desktop shell (client + API + Electron)
npm run desktop:dev

# After upgrading Electron or better-sqlite3:
npm run rebuild:electron

# Production build (SDK + client + API)
npm run build
```

| Surface | URL |
|---------|-----|
| Client | http://127.0.0.1:5173 |
| API | http://127.0.0.1:8787 |

Health checks: `/healthz`, `/v1/health`, `/api/health` — or `npm run agent:status`.

## Agent spawn model

One **background runner** (Pi, Codex, Hermes, or Cursor) per agent identity:

| Agent | Instance id | Scope |
|-------|-------------|-------|
| **Dude** (main assistant) | `{org}:main-assistant:{userId}` | One runner per user thread |
| **Specialist** | `{org}:{specialistKind}:{workspaceId}` | One runner per workspace |
| **Custom** | `{org}:{yourKind}:{scopeId}` | Same pattern |

Dude delegates to specialists via tools — each delegation spawns or reuses that specialist's runner. Tools are served by the **Tool Host** (`/v1/internal/tool-host/*`).

```
User → Dude runner (main-assistant)
         ├─ tool: data-analyst → specialist runner (workspace A)
         ├─ tool: document-writer → specialist runner (workspace B)
         └─ direct chat in workspace → that workspace's specialist runner
```

Helpers: `@dude/sdk/runner` — `buildMainAssistantInstanceId`, `buildSpecialistInstanceId`, `MAIN_ASSISTANT_KIND`.

## Monorepo layout

```
dude/
  apps/
    client/              # Vite + React SPA (web + Electron renderer)
    api/                 # Unified Elysia server (REST + AI gateway)
  packages/
    sdk/                 # @dude/sdk — defineSpecialist, registry, gateway types
    ui/                  # Design system (shadcn)
    chat/                # Shared specialist chat shell
    workspaces/          # Workspace CRUD, assistant, uploads
    data-analyst-core/   # Reports, json-render, SQL UI
    presentation-editor/ # PPTX editor domain
    gateway-shared/      # html-preview, tool labels
    specialist-*/        # Installable specialists (UI + gateway)
    …                    # client-types, app-navigation, specialist-params, …
  electron/              # Desktop shell
  scripts/               # Agent harness, icon generation, probes
  specialists.config.ts         # Server host (API, tool-host, spawn)
  specialists.config.client.ts  # Browser-safe host (UI only)
```

### Registered specialists

| Package | Role |
|---------|------|
| `@dude/specialist-data-analyst` | Data analysis, charts, SQL workspaces |
| `@dude/specialist-document-editor` | Rich document editing |
| `@dude/specialist-document-writer` | Structured document / canvas writing |
| `@dude/specialist-prospect` | Prospect research workflows |
| `@dude/specialist-design-branding` | Brand and design tasks |

Register new specialists in both `specialists.config.ts` and `specialists.config.client.ts`. See [CREATING-A-SPECIALIST.md](./docs/CREATING-A-SPECIALIST.md).

### API surfaces

One Elysia process on port **8787**:

| Prefix | Purpose |
|--------|---------|
| `/api/*` | Minimal app REST (`GET /api`, `GET /api/health`) |
| `/v1/*` | Gateway — instances, workspaces, chat, `/v1/internal/tool-host/*` |

Workspace CRUD, chat turns, and specialist actions go through `/v1/*`, not `/api/*`.

## Testing with the agent harness

For Cursor agents and local smoke tests without Playwright:

```bash
npm run dev
npm run agent:status

npm run agent -- workspaces create --specialist document-writer --name "Smoke test"
npm run agent -- chat --specialist document-writer --workspace <id> --message "Hello"
```

Full CLI reference: [scripts/agent-harness/README.md](./scripts/agent-harness/README.md). Agents in this repo should follow [.cursor/rules/dude-agent-testing.mdc](./.cursor/rules/dude-agent-testing.mdc).

Specialist IDs used by the harness include: `main-assistant`, `data-analyst`, `document-writer`, `presentation-editor`, `design-branding`, `prospect`.

## Adding a specialist

1. Create `packages/specialist-my-agent/` exporting `defineSpecialist(...)` from `@dude/sdk`
2. Add the package to root `package.json` workspace dependencies
3. Register in `specialists.config.ts` and `specialists.config.client.ts`
4. Put gateway tools in your package's `gateway/` folder; shared base tools in `apps/api/src/lib/tool-host/tools/`

## Environment (desktop / packaged)

Optional runtime secrets for packaged desktop: copy [desktop.env.example](./desktop.env.example) to `dude.env` (next to app resources or in Electron userData). Do not commit real keys. Local dev typically uses `.env.local` at the repo root (gitignored).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Client + API (`dev:api:desktop`) |
| `npm run dev:client` | Vite only |
| `npm run dev:api` | Elysia via `tsx` (Node SQLite — run `rebuild:sqlite:node` if native module errors) |
| `npm run desktop:dev` | Client + API + Electron |
| `npm run desktop:local` | Built client served from Electron (offline) |
| `npm run desktop:pack` / `desktop:dist` | electron-builder output |
| `npm run rebuild:electron` | Rebuild `better-sqlite3` for Electron |
| `npm run rebuild:sqlite:node` | Rebuild `better-sqlite3` for plain Node |
| `npm run build` | SDK + client + API |
| `npm run test` | Jest |
| `npm run lint` | ESLint (`packages/`) |
| `npm run generate:specialists` | Regenerate specialist scaffolds |
| `npm run generate:icons` | App icons for desktop |
| `npm run agent -- <cmd>` | Local agent/CLI harness |
| `npm run agent:status` | Check client + API reachability |

## Tech stack

| Layer | Technology |
|-------|------------|
| Client | Vite 5, React 19, React Router 7, Tailwind CSS |
| API + gateway | Elysia 1 on Node (`@elysiajs/node`), SQLite (`better-sqlite3`) |
| Desktop | Electron 42, local persistence |
| AI runtime | Swappable harness adapters (`pi`, `codex`, `hermes`, `cursor`) via `@dude/sdk/runner` |
| Tool Host | `GET/POST /v1/internal/tool-host/*` — runners fetch and execute tools remotely |
| UI | `@dude/ui` (shadcn), Framer Motion, Zustand, TipTap, Vega/Recharts |
