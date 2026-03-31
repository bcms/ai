# BCMS `ai/` — notes for agents and automation

This folder is the **BCMS AI skill pack**: guidance for coding agents (Cursor, Claude Code, etc.) and optional local tooling.

## Layout

| Path | Role |
|------|------|
| `skills/bcms/SKILL.md` | **Canonical** BCMS skill (~500 lines). Edit here. |
| `skills/bcms-mcp/SKILL.md` | Thin skill: MCP remote server only; points at `references/mcp.md`. |
| `references/*.md` | Deep dives (MCP, Next.js, Astro, Functions, etc.). |
| `scripts/` | TypeScript SDK examples (`init-client.ts`, `call-function.ts`); not MCP. |
| `providers/claude/plugin/` | Claude Code plugin: symlinks to canonical skill + `references/`. |
| `.agents/skills/skill-creator/` | Optional **skill-creator** skill (evals, packaging scripts); for maintainers improving skills—not part of the BCMS plugin bundle. |
| `CHANGELOG.md` | Version history of this pack. |

## Plugin packaging

- `providers/claude/plugin/skills/bcms-best-practices/SKILL.md` → symlink to `skills/bcms/SKILL.md`.
- `providers/claude/plugin/skills/bcms-best-practices/references` → symlink to `references/`.
- On **Windows**, if git or the filesystem does not support symlinks, **copy** the canonical files into the plugin paths when building or publishing the plugin.

## MCP vs SDK

- **MCP** (remote BCMS tools): see `references/mcp.md` — session header, env-based URL, pointer links for internal entry/media links.
- **SDK** (`@thebcms/client`): see `references/nextjs.md` / `references/astro.md` and `scripts/` for minimal examples.
