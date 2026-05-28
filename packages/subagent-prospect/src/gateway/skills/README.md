# Website (prospect) subagent skill packs

Vendored from the open agent skills ecosystem and loaded by Pi SDK at agent startup (see `specialists/prospect.ts → skillPaths`). Pi appends a discovery XML block to the system prompt and expands each skill's body into context only when the agent invokes it.

The subagent id is `prospect` for historical reasons; the user-facing role is the "Website Subagent" (landing pages, lead capture funnels, conversion).

## Vendored skills

| Skill | Upstream | Installs (at vendor time) |
|---|---|---|
| `landing-page-design` | `infsh-skills/skills@landing-page-design` | 10.7K |
| `landing-page-copywriter` | `onewave-ai/claude-skills@landing-page-copywriter` | 2.8K |
| `copywriting` | `coreyhaines31/marketingskills@copywriting` | 82.8K |

## Updating

```bash
npx skills add <upstream> -g -y
cp -R ~/.agents/skills/<skill> packages/specialist-prospect/src/gateway/skills/
```

Don't edit SKILL.md files in place — keep them faithful to upstream.
