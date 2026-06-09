# BCMS `ai/` — notes for agents and automation

This folder is the **BCMS AI skill pack**: guidance for coding agents (Cursor, Claude Code, etc.) and optional local tooling.

## Install (skills.sh)

```bash
npx skills add bcms/ai --skill bcms          # guidance (SDK + modeling + MCP)
npx skills add bcms/ai --skill bcms-content  # executable content CLI
```

## Layout

| Path | Role |
|------|------|
| `skills/bcms/SKILL.md` | **Canonical** BCMS skill (~500 lines). Edit here. Skill name: `bcms`. Covers SDK building **and** MCP content operations. |
| `skills/bcms-content/SKILL.md` | **Canonical** `bcms-content` skill. Edit here. Executable content CLI (`cli/bcms.mjs` + `package.json`, dep `@thebcms/client`) for entry/media ops via `BCMS_API_KEY`. |
| `skills/bundle.json` | Maps each skill to reference files copied into `skills/<skill>/references/`. |
| `references/*.md` | **Canonical** deep dives — edit here, then run sync. |
| `scripts/sync-skill-references.mjs` | Copies bundled references into skill folders for skills.sh / ClawHub. |
| `scripts/` | Also: SDK examples, `validate-cursor-plugin.mjs`. |
| `providers/claude/plugin/` | Claude Code plugin: symlinks to canonical skill + `references/`. |
| `providers/cursor/plugin/` | Cursor plugin: same symlink pattern; see `.cursor-plugin/marketplace.json`. |
| `.cursor-plugin/marketplace.json` | Cursor marketplace manifest. |
| `CHANGELOG.md` | Version history of this pack. |

## Skill reference sync

skills.sh installs each skill folder from GitHub. Reference files must live **inside** the skill directory (`references/mcp.md`, not `../../references/mcp.md`).

1. Edit canonical files in `references/`.
2. Update `skills/bundle.json` when a skill needs new reference files.
3. Run `node scripts/sync-skill-references.mjs` (or `--check` in CI).
4. Commit both canonical and generated `skills/*/references/` files.

## Plugin packaging

### Claude Code

- `providers/claude/plugin/skills/bcms/SKILL.md` → symlink to `skills/bcms/SKILL.md`.
- `providers/claude/plugin/skills/bcms/references` → symlink to `references/`.
- `providers/claude/plugin/skills/bcms-content/SKILL.md` → symlink to `skills/bcms-content/SKILL.md`.
- `providers/claude/plugin/skills/bcms-content/references` → symlink to `references/`.

### Cursor

- `providers/cursor/plugin/skills/bcms/SKILL.md` → symlink to `skills/bcms/SKILL.md`.
- `providers/cursor/plugin/skills/bcms/references` → symlink to `references/`.
- `providers/cursor/plugin/skills/bcms-content/SKILL.md` → symlink to `skills/bcms-content/SKILL.md`.
- `providers/cursor/plugin/skills/bcms-content/references` → symlink to `references/`.
- `providers/cursor/plugin/references` → symlink to `references/` (legacy path for plugin layout).

The plugins symlink **`SKILL.md`** and **`references/`** only — the `bcms-content` CLI runtime (`cli/`, `package.json`) ships via the skills.sh/ClawHub skill folder, where the agent runs `npm install` once.

On **Windows**, if git or the filesystem does not support symlinks, **copy** the canonical files into the plugin paths when building or publishing either plugin.

## MCP vs SDK

- **MCP** (remote BCMS tools): see `references/mcp.md` — session header, env-based URL, pointer links for internal entry/media links.
- **SDK** (`@thebcms/client`): see `references/nextjs.md` / `references/astro.md` and `scripts/` for minimal examples.
