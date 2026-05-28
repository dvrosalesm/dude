# Dude architecture (real packages)

Dude is a **local-first** monorepo: Vite/Electron client, Elysia API, pluggable subagents. Product code lives in **workspace packages** with enforced dependency direction — not a shared `src/` monolith.

## Layering

```
apps/client, apps/api          ← thin shells (routing, HTTP, desktop bridge)
packages/subagent-*          ← domain UI + gateway tools + domain stores/libs
packages/chat                  ← shared subagent chat shell, hooks, workspace chrome
packages/presentation-editor   ← PPTX editor domain
packages/data-analyst-core     ← json-render, reports, SQL UI helpers
packages/ui                    ← shadcn + design-system
packages/workspaces            ← workspace CRUD, assistant, uploads, routes
packages/gateway-shared        ← html-preview, tool-labels
packages/subagent-params     ← workspaceId / embedded context
packages/subagent-utils      ← shared config normalizers
packages/app-navigation        ← Next-compatible Link + useRouter for Vite
packages/client-types          ← LocalChatRuntime, SubagentId, …
packages/sdk                   ← defineSubagent, registry, gateway types
```

## Rules

1. **`packages/**` must not import `@/`** — ESLint blocks the removed legacy alias repo-wide.
2. **One canonical module per concept** — no mirrored shim copies.
3. **Subagents depend down only** — `@dude/ui`, `@dude/workspaces`, `@dude/chat`, domain libs in the same subagent package.
4. **No legacy tool-host shims** — API loads tools from `@dude/subagent-*/gateway/tools` and `apps/api/src/lib/tool-host/`.
5. **Files stay under ~800 lines** — split before adding features to large modules.
6. **Use `@dude/*` in all new code** — root `src/` was removed.

## Package map (migration status)

| Package | Status |
|---------|--------|
| `@dude/sdk` | Contracts |
| `@dude/client-types` | Client/runtime types |
| `@dude/ui` | Design system + shadcn (33 components) |
| `@dude/chat` | Shared chat UI, workspace list shell |
| `@dude/workspaces` | Workspace client API |
| `@dude/gateway-shared` | Puppeteer html-preview, tool-labels |
| `@dude/presentation-editor` | PPTX types, store, lib, components |
| `@dude/chat` | Subagent chat, layouts, hooks, chat markdown |
| `@dude/data-analyst-core` | Data analyst render pipeline |
| `@dude/subagent-*` | Per-domain UI + gateway; stores/libs colocated |
| `@dude/subagent-params` | `useWorkspaceId`, `useIsEmbedded` |
| `@dude/subagent-utils` | Identifier/url/boolean normalizers |
| `@dude/app-navigation` | Client-side routing helpers |

## Runtime stack

- **Client:** React 19, Vite, Electron, React Router
- **API:** Elysia, SQLite, pi-coding-agent gateway
- **AI:** Subagent registry + per-workspace agent processes
