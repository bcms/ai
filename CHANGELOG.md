# Changelog — BCMS AI skill pack (`ai/`)

All notable changes to the canonical skill, references, plugin packaging, and local examples are documented here.

## [1.1.3] — 2026-03-31

### Removed

- **`ai/.agents/skills/skill-creator/`**: removed bundled Anthropic skill-creator from this repo (install from [anthropics/skills](https://github.com/anthropics/skills) or [skills.sh](https://skills.sh) if needed).

### Changed

- **`ai/AGENTS.md`**: dropped `.agents/` row.
- **Claude Code plugin** metadata version **1.1.3**.

## [1.1.2] — 2026-03-31

### Changed

- **Client env model**: removed the four-argument `Client(orgId, instanceId, { id, secret }, …)` pattern and split env vars (`BCMS_ORG_ID`, etc.). All guides and scripts now use a **single three‑part `BCMS_API_KEY`** and options‑only `Client`, per [thebcms.com/docs](https://thebcms.com/docs/integrations).
- **`scripts/init-client.ts`**, **`scripts/call-function.ts`**, **`references/bcms-api-basics.md`**, framework reference pages, **`references/media.md`**, **`references/frameworks.md`**, **`README.md`**, canonical **`skills/bcms/SKILL.md`**: updated accordingly.

## [1.1.1] — 2026-03-31

### Added

- **`ai/.agents/skills/skill-creator/`**: bundled Anthropic **skill-creator** skill (eval workflows, scripts, references) for maintainers editing or benchmarking skills in this repo.

### Changed

- **`ai/AGENTS.md`**: documents `.agents/` role.
- **Claude Code plugin** metadata version **1.1.1**.

## [1.1.0] — 2026-03-31

### Added

- **`ai/references/mcp.md`**: environment-based URL configuration, session lifecycle, HTTP error table, pagination/limits, minimal ProseMirror JSON examples, recipes (discover, draft→publish, new entry, internal links).
- **`ai/AGENTS.md`**: repo layout and pointers for automation.
- **`ai/skills/bcms-mcp/SKILL.md`**: thin skill for MCP-only workflows (load `references/mcp.md` first).
- **`ai/scripts/`**: `init-client.ts`, `call-function.ts` (SDK examples; documented in canonical skill).

### Changed

- **Canonical skill** (`ai/skills/bcms/SKILL.md`): maintenance note (single source of truth), section linking to `ai/scripts/`, `CHANGELOG`, and `AGENTS`.
- **Docs alignment**: client init and env vars match [thebcms.com/docs](https://thebcms.com/docs) integration guides (`BCMS_API_KEY` three‑part string + options‑only `Client`). **Next** / **Nuxt** reference pages updated; **entries** examples use official node tree shape; **MCP** notes cover DELETE in UI vs supported operations and both upload tool styles.
- **Claude Code plugin** (`ai/providers/claude/plugin/`): `bcms-best-practices/SKILL.md` is a **symlink** to the canonical skill; `references` symlink unchanged; plugin metadata version **1.1.0**.
- **`ai/README.md`**: consolidated layout, symlink note for Windows.

### Fixed

- Plugin `references` symlink path (five `..` segments to `ai/references/`).
- **`skills/bcms/references`**: entire directory symlinked to `ai/references/` so `references/*.md` paths in the canonical skill resolve for every guide (not only `mcp.md`).

## [1.0.0] — prior

Initial skill pack (`1.0.0`), `references/*.md`, and plugin layout without the 1.1 consolidation (canonical skill symlink, `bcms-mcp`, `mcp.md`, `scripts/`, `AGENTS.md`).
