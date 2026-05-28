# Creating a Specialist Package

Dude core owns only the **main assistant**. Every subagent is an installable npm package under `packages/specialist-*`.

## Architecture

```
packages/specialist-my-agent/
  src/
    index.ts           # Client-safe plugin (UI + manifest + API registrar)
    server.ts          # Full plugin with gateway manifest (Node only)
    api/routes.ts      # Elysia routes (optional; local dev API is often shared)
    gateway/manifest.ts # Pi gateway declaration (Node only)
    ui/
      page.tsx         # Workspace list
      [workspaceId]/page.tsx
```

The unified server lives in `apps/api` (`@dude/api`, default port **8787**):

- `/api/*` — minimal app REST (`GET /api`, `GET /api/health`, specialist registry listing)
- `/v1/*` — gateway (instances, runners, proxy, chat turns)
- `/v1/internal/*` — localhost-only (tool-host, workspace CRUD, assistant, UI input)
- `/healthz` — Electron readiness probe

The Vite client (`apps/client`, port **5173**) proxies `/api` and `/v1` to Elysia in browser dev.

Hosts load packages via two config files at the repo root (no copies under `apps/api/`):

- `specialists.config.client.ts` — browser (imports `./index.ts` only)
- `specialists.config.ts` — canonical server config for API, tool-host, and agent spawn (imports `./server.ts`)

## Quick start

```bash
npm run generate:specialists   # scaffold from scripts/generate-specialist-packages.mjs
```

Or copy an existing package such as `packages/specialist-document-writer/`.

## Plugin contract

```typescript
import { defineSpecialist } from "@dude/sdk";
import { PenLine } from "lucide-react";
import { registerApiRoutes } from "./api/routes.js";
import ListPage from "./ui/page";
import WorkspacePage from "./ui/[workspaceId]/page";

export default defineSpecialist({
  id: "my-agent",              // canonical DB / gateway id
  path: "my-agent",            // URL segment
  manifest: {
    gatewayLabel: "My Agent",
    gatewayDescription: "What the main assistant reads when delegating.",
    delegable: true,
    badges: ["Example"],
  },
  ui: { icon: PenLine, ListPage, WorkspacePage },
  api: registerApiRoutes,
  local: {
    summary: {
      id: "my-agent",
      name: "My Agent",
      handle: "MINE",
      scope: "Short scope string for desktop UI.",
      status: "ready",
    },
  },
});
```

`server.ts` merges the gateway manifest:

```typescript
import clientPlugin from "./index.js";
import { gatewayManifest } from "./gateway/manifest.js";

export default { ...clientPlugin, gateway: gatewayManifest };
```

## Register the package

1. Add `"@dude/specialist-my-agent": "*"` to root `package.json`
2. Import in `specialists.config.client.ts` and `specialists.config.ts`
3. Declare custom tools in your package's `gateway/declaration-source.ts` (loaded via root `specialists.config.ts`)
4. Use plain English strings in UI components (no i18n layer)

## Shared UI shell

Reuse from `@dude/chat`:

- `SpecialistWorkspaceList` — workspace list/create page
- `SpecialistChat` + `useSpecialistChat` — chat panel
- `WorkspaceHeaderBar` — workspace chrome

List pages typically wrap `SpecialistWorkspaceList`:

```tsx
<SpecialistWorkspaceList
  specialistId="my-agent"
  title="My Agent"
  subtitle="Short subtitle for the list page"
  emptyTitle="No workspaces yet"
  emptyDescription="Create a workspace to get started."
/>
```

## Elysia API routes

Specialist-specific REST endpoints mount at `/api/agents/specialists/{path}/` via `@dude/sdk/api`. Most workspace CRUD and shared utilities are handled centrally in `apps/api/src/lib/local-api/handlers.ts`.

```typescript
import type { Elysia } from "elysia";

export function registerApiRoutes(app: Elysia) {
  app.get("/", () => ({ ok: true, specialist: "my-agent" }));
  app.post("/workspaces/:workspaceId/custom-action", async ({ body }) => {
    // specialist-specific logic; chat uses runAssistantMessage from @dude/workspaces
    return { ok: true };
  });
}
```

## Gateway declaration

```typescript
// gateway/manifest.ts
export const gatewayManifest = {
  declaration: {
    baseTools: ["web_search", "workspace_read", "save_memory", "list_memories"],
    customTools: [], // wired in apps/api CUSTOM_TOOL_FACTORIES
    collections: ["myCollection"],
    skillPaths: [],
  },
};
```

## Rules

- **Main assistant stays in core** — do not add orchestrator logic to specialist packages
- **One package = one specialist** — UI, API, and gateway metadata travel together
- **No Node imports in `index.ts`** — keep gateway manifest in `server.ts` / `gateway/manifest.ts`
- **Integrations are per-org** — specialists read credentials via shared host helpers, not package-local OAuth state

## Reference packages

| Package | Gateway | Notes |
|---------|---------|-------|
| `specialist-data-analyst` | yes | SQL/Python tools |
| `specialist-document-editor` | yes | path `presentation-editor`, id `document-editor` |
| `specialist-document-writer` | yes | TipTap canvas |
| `specialist-prospect` | yes | Landing pages |
| `specialist-design-branding` | yes | React Flow canvas |

## Local dev

```bash
npm run dev          # Vite :5173 + Elysia :8787
npm run desktop:dev  # above + Electron shell
```

Browser dev uses the Vite proxy to Elysia. Packaged Electron (`file:`) uses a fetch shim to `http://127.0.0.1:8787`. Set `VITE_USE_LOCAL_API=true` only if you need the legacy in-browser fetch adapter.
