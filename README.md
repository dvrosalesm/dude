# Dude

![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Elysia](https://img.shields.io/badge/Elysia-1-3B82F6)
![Electron](https://img.shields.io/badge/Electron-35-47848F?logo=electron&logoColor=white)
![License](https://img.shields.io/badge/License-Proprietary-FBB76B)

Local-first AI workspace. **Dude core** is the main assistant orchestrator. Every subagent is an installable `@dude/specialist-*` package.

Additional documentation: [docs/](./docs/README.md) (architecture, specialist authoring, [design system](./docs/design.md)).

## Agent spawn model

One **background runner** (Pi, Codex, Hermes, or Cursor) per agent identity:

| Agent | Instance id | Scope |
|-------|-------------|-------|
| **Dude** (main assistant) | `{org}:main-assistant:{userId}` | One runner per user thread |
| **Specialist** | `{org}:{specialistKind}:{workspaceId}` | One runner per workspace |
| **Custom** | `{org}:{yourKind}:{scopeId}` | Same pattern |

Dude delegates to specialists via tools — each delegation spawns or reuses that specialist's own runner. Tools come from the **Tool Host** (`/v1/internal/tool-host/*`).

```
User → Dude runner (main-assistant)
         ├─ tool: data-analyst → specialist runner (workspace A)
         ├─ tool: document-editor → specialist runner (workspace B)
         └─ direct chat in workspace → that workspace's specialist runner
```

Helpers: `@dude/sdk/runner` — `buildMainAssistantInstanceId`, `buildSpecialistInstanceId`, `MAIN_ASSISTANT_KIND`.

## Architecture

```
dude/
  apps/
    client/          # Vite + React SPA (desktop + web)
    api/             # Unified Elysia server (REST + AI gateway)
  packages/
    sdk/             # @dude/sdk — plugin contract + registry
    specialist-*/    # Installable specialist packages
  electron/          # Desktop shell
  specialists.config.ts         # Server config (API + gateway)
  specialists.config.client.ts  # Browser-safe config
```

Specialist packages plug into two host configs:

| Host | Config | Role |
|------|--------|------|
| `@dude/client` | `specialists.config.client.ts` | UI (list + workspace pages) |
| `@dude/api` | `specialists.config.ts` | Unified server: minimal `/api/*` + `/v1/*` gateway |

One Elysia process on port **8787** serves health, a minimal app REST surface (`GET /api`, `GET /api/health`), and the full gateway (`/v1/instances`, `/v1/internal/tool-host/*`, etc.). Workspace CRUD, chat turns, and specialist actions go through `/v1/*`, not `/api/*`.

## Development

```bash
npm install

# Vite client + unified Elysia server
npm run dev

# Desktop (client + API + Electron)
npm run desktop:dev

# After upgrading Electron or better-sqlite3, rebuild native modules once:
npm run rebuild:electron

# Build everything
npm run build
```

- Client: `http://127.0.0.1:5173`
- Server: `http://127.0.0.1:8787` (`/api/*` health + registry, `/v1/*` gateway)

## Adding a specialist

1. Create `packages/specialist-my-agent/` exporting `defineSpecialist(...)` from `@dude/sdk`
2. Add the package to root `package.json` workspace dependencies
3. Register in `specialists.config.ts` and `specialists.config.client.ts`
4. Gateway tools live in your package's `gateway/` folder; shared base tools in `apps/api/src/lib/tool-host/tools/`

See [CREATING-A-SPECIALIST.md](./docs/CREATING-A-SPECIALIST.md) for the full package authoring guide.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite client + unified server |
| `npm run dev:client` | Vite only |
| `npm run dev:api` | Elysia server only |
| `npm run desktop:dev` | Client + API + Electron |
| `npm run rebuild:electron` | Rebuild `better-sqlite3` for Electron (after install or Electron upgrade) |
| `npm run build` | SDK + client + API |
| `npm run lint` | ESLint (packages, apps, tests) |
| `npm run generate:specialists` | Regenerate specialist package scaffolds |

## Tech stack

| Layer | Technology |
|-------|------------|
| Client | Vite 5, React 19, React Router, Tailwind CSS |
| API + gateway | Elysia 1 on Node (`@elysiajs/node`) |
| Desktop | Electron 35, SQLite (local persistence) |
| AI runtime | Swappable harness adapters (`pi`, `codex`, `hermes`, `cursor`) via `@dude/sdk/runner` |
| Tool Host | `GET/POST /v1/internal/tool-host/*` — runners fetch tools + execute remotely |
| UI | shadcn/ui, Framer Motion, Zustand |
# dude
# dude
