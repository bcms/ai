# BCMS `ai/` — notes for agents and automation

This folder is the **BCMS AI skill pack**: guidance for coding agents (Cursor, Claude Code, etc.) and optional local tooling.

## Layout

| Path | Role |
|------|------|
| `skills/bcms/SKILL.md` | **Canonical** BCMS skill (~500 lines). Edit here. |
| `skills/bcms-mcp/SKILL.md` | Thin skill: MCP remote server only; points at `references/mcp.md`. |
| `references/*.md` | Deep dives (MCP, Next.js, Astro, Functions, etc.). |
| `scripts/` | TypeScript SDK examples (`init-client.ts`, `call-function.ts`); `validate-cursor-plugin.mjs` for the Cursor bundle. |
| `providers/claude/plugin/` | Claude Code plugin: symlinks to canonical skill + `references/`. |
| `providers/cursor/plugin/` | Cursor plugin: same symlink pattern + plugin-root `references` for `bcms-mcp` links; see `.cursor-plugin/marketplace.json`. |
| `.cursor-plugin/marketplace.json` | Cursor marketplace manifest (schema: `name`, `source`, `description` per plugin entry). |
| `CHANGELOG.md` | Version history of this pack. |

## Plugin packaging

### Claude Code

- `providers/claude/plugin/skills/bcms-best-practices/SKILL.md` → symlink to `skills/bcms/SKILL.md`.
- `providers/claude/plugin/skills/bcms-best-practices/references` → symlink to `references/`.

### Cursor

- `providers/cursor/plugin/skills/bcms-best-practices/SKILL.md` → symlink to `skills/bcms/SKILL.md`.
- `providers/cursor/plugin/skills/bcms-best-practices/references` → symlink to `references/`.
- `providers/cursor/plugin/skills/bcms-mcp/SKILL.md` → symlink to `skills/bcms-mcp/SKILL.md`.
- `providers/cursor/plugin/references` → symlink to `references/` (so `../../references/` from the MCP skill resolves).

On **Windows**, if git or the filesystem does not support symlinks, **copy** the canonical files into the plugin paths when building or publishing either plugin.

## MCP vs SDK

- **MCP** (remote BCMS tools): see `references/mcp.md` — session header, env-based URL, pointer links for internal entry/media links.
- **SDK** (`@thebcms/client`): see `references/nextjs.md` / `references/astro.md` and `scripts/` for minimal examples.
