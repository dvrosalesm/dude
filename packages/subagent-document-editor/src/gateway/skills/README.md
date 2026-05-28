# Presentation editor (document-editor) subagent skill packs

Vendored from the open agent skills ecosystem and loaded by Pi SDK at agent startup (see `specialists/document-editor.ts → skillPaths`). Pi appends a discovery XML block to the system prompt and expands each skill's body into context only when the agent invokes it.

The subagent id is `document-editor` for historical reasons (it edits PowerPoint-style presentations); the user-facing name is "Presentation Editor".

## Vendored skills

| Skill | Upstream | Installs (at vendor time) |
|---|---|---|
| `baoyu-slide-deck` | `jimliu/baoyu-skills@baoyu-slide-deck` | 18.3K |
| `pptx-generator` | `minimax-ai/skills@pptx-generator` | 2.3K |
| `presentation-design` | `jwynia/agent-skills@presentation-design` | 1.2K |
| `giving-presentations` | `refoundai/lenny-skills@giving-presentations` | 1.3K |
| `pitch-deck` | `anthropics/financial-services-plugins@pitch-deck` | 477 |

## Updating

```bash
npx skills add <upstream> -g -y
cp -R ~/.agents/skills/<skill> packages/specialist-document-editor/src/gateway/skills/
```

Don't edit SKILL.md files in place — keep them faithful to upstream.
