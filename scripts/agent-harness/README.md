# Dude agent harness

Tools for **Cursor agents** (and humans) to run and verify Dude locally without adding Playwright.

## Quick start

```sh
npm run dev
npm run agent:status
```

| Surface | URL |
|---------|-----|
| Client | http://127.0.0.1:5173 |
| API | http://127.0.0.1:8787 |

`npm run dev` starts the API via Electron’s Node (`dev:api:desktop`) so `better-sqlite3` matches the desktop build.

## CLI (`npm run agent -- <command>`)

| Command | Purpose |
|---------|---------|
| `status` | Client + API reachable |
| `url --specialist <id> [--workspace <id>]` | Open URL for browser MCP |
| `workspaces list --specialist <id>` | List SQLite workspaces |
| `workspaces create --specialist <id> --name "..."` | Create workspace + print `openUrl` |
| `chat --specialist <id> --message "..." [--workspace <id>]` | API-only agent turn (waits for completion) |
| `probe document-writer` | Document Writer health + CDP snippets |
| `browser-hints` | JSON cheat sheet for `cursor-ide-browser` |

Add `--json` on any command for machine-readable output.

### API-only smoke (no browser)

```sh
npm run agent -- workspaces create --specialist document-writer --name "Agent smoke"
# copy workspace id from output

npm run agent -- chat --specialist document-writer \
  --workspace <workspace-id> \
  --message "Add a title and one short paragraph about testing."
```

Uses `POST /v1/internal/assistant/specialist-run` (localhost-only).

### Browser MCP (full UI)

1. `npm run agent -- browser-hints --specialist document-writer --workspace <id>`
2. `browser_navigate` → `openUrl`
3. `browser_snapshot` → send a prompt in chat
4. After the turn finishes, evaluate:

```javascript
window.__DUDE_AGENT__?.snapshot()
// document-writer canvas:
window.__DUDE_DW_DEBUG__?.snapshot()
```

Global hooks attach in **dev** only (`import.meta.env.DEV`).

## Specialist IDs

`main-assistant`, `data-analyst`, `document-writer`, `presentation-editor`, `design-branding`, `prospect`

## Cursor rule

Agents should read `.cursor/rules/dude-agent-testing.mdc` when testing or debugging Dude in this repo.

## Related

- `scripts/ui-harness/` — specialist-specific probes (Document Writer today)
- `packages/specialist-document-writer/src/ui/dev-debug.ts` — `window.__DUDE_DW_DEBUG__`
- `apps/client/src/agent-debug.ts` — `window.__DUDE_AGENT__`
