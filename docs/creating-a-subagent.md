# Creating a Subagent Package

Dude core owns only the **main assistant**. Every subagent is an installable npm package under `packages/subagent-*`.

## Architecture

```
packages/subagent-my-agent/
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

- `/api/*` — minimal app REST (`GET /api`, `GET /api/health`, subagent registry listing)
- `/v1/*` — gateway (instances, runners, proxy, chat turns)
- `/v1/internal/*` — localhost-only (tool-host, workspace CRUD, assistant, UI input)
- `/healthz` — Electron readiness probe

The Vite client (`apps/client`, port **5173**) proxies `/api` and `/v1` to Elysia in browser dev.

Hosts load packages via two config files at the repo root (no copies under `apps/api/`):

- `subagents.config.client.ts` — browser (imports `./index.ts` only)
- `subagents.config.ts` — canonical server config for API, tool-host, and agent spawn (imports `./server.ts`)

## Quick start

```bash
npm run generate:subagents   # scaffold from scripts/generate-subagent-packages.mjs
```

Or copy an existing package such as `packages/subagent-document-writer/`.

## Plugin contract

```typescript
import { defineSubagent } from "@dude/sdk";
import { PenLine } from "lucide-react";
import { registerApiRoutes } from "./api/routes.js";
import ListPage from "./ui/page";
import WorkspacePage from "./ui/[workspaceId]/page";

export default defineSubagent({
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

1. Add `"@dude/subagent-my-agent": "*"` to root `package.json`
2. Import in `subagents.config.client.ts` and `subagents.config.ts`
3. Declare custom tools in your package's `gateway/declaration-source.ts` (loaded via root `subagents.config.ts`)
4. Use plain English strings in UI components (no i18n layer)

## Shared UI shell

Reuse from `@dude/chat`:

- `SubagentWorkspaceList` — workspace list/create page
- `SubagentChat` + `useSubagentChat` — chat panel
- `WorkspaceHeaderBar` — workspace chrome

List pages typically wrap `SubagentWorkspaceList`:

```tsx
<SubagentWorkspaceList
  subagentId="my-agent"
  title="My Agent"
  subtitle="Short subtitle for the list page"
  emptyTitle="No workspaces yet"
  emptyDescription="Create a workspace to get started."
/>
```

## Elysia API routes

Specialist-specific REST endpoints mount at `/api/agents/subagents/{path}/` via `@dude/sdk/api`. Most workspace CRUD and shared utilities are handled centrally in `apps/api/src/lib/local-api/handlers.ts`.

```typescript
import type { Elysia } from "elysia";

export function registerApiRoutes(app: Elysia) {
  app.get("/", () => ({ ok: true, subagent: "my-agent" }));
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

- **Main assistant stays in core** — do not add orchestrator logic to subagent packages
- **One package = one specialist** — UI, API, and gateway metadata travel together
- **No Node imports in `index.ts`** — keep gateway manifest in `server.ts` / `gateway/manifest.ts`
- **Integrations are per-org** — subagents read credentials via shared host helpers, not package-local OAuth state

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
