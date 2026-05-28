# UI harness (browser / CDP)

Programmatic checks for subagent UIs without adding Playwright to the repo.

**Start here for agents:** [`scripts/agent-harness/README.md`](../agent-harness/README.md) — unified CLI (`npm run agent`), workspaces, API chat, and browser MCP hints.

## Prerequisites

```sh
npm run dev
# client http://127.0.0.1:5173 — API http://127.0.0.1:8787
```

`npm run dev` starts the API via Electron’s Node (`dev:api:desktop`) so `better-sqlite3` matches `postinstall`’s `electron-rebuild`. If you see **Gateway request failed (500)** with an empty body, the API is not listening (Vite proxy error) — check the terminal for `[dude-server] listening on http://127.0.0.1:8787`.

## Document Writer smoke

```sh
node scripts/ui-harness/document-writer-probe.mjs
```

The probe:

1. Verifies client + API are reachable
2. Prints CDP/`Runtime.evaluate` snippets for Cursor browser MCP
3. Can be run after manual or automated navigation to a workspace

### Browser MCP flow (Cursor `cursor-ide-browser`)

1. `browser_navigate` → `http://127.0.0.1:5173/chat/subagents/document-writer`
2. Create or open a workspace from the list UI
3. `browser_snapshot` — find chat input, send a short prompt (e.g. "Add a title and one paragraph about testing")
4. After the agent finishes, run CDP evaluate (from probe output):

```javascript
window.__DUDE_DW_DEBUG__?.snapshot()
```

Expect `blockCount > 0` and `editorTextLength > 0` when the canvas reflects AI edits.

### Electron desktop (optional)

```sh
npm run desktop:dev
```

Same URLs; preload exposes `window.dudeDesktop`. Document-writer debug hooks are separate: `window.__DUDE_DW_DEBUG__`.

## Debug session logs

Agent instrumentation posts to the Cursor debug ingest URL (see `.cursor/debug-*.log` in the repo). Clear that file before each reproduction run.
