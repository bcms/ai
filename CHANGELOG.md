# Changelog — BCMS AI skill pack (`ai/`)

All notable changes to the canonical skill, references, plugin packaging, and local examples are documented here.

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
- **Docs alignment**: client init and env vars match [thebcms.com/docs](https://thebcms.com/docs) integration guides (`BCMS_API_KEY` + options `Client` first; four-arg constructor documented as alternate). **Next** / **Nuxt** reference pages updated; **entries** examples use official node tree shape; **MCP** notes cover DELETE in UI vs supported operations and both upload tool styles.
- **Claude Code plugin** (`ai/providers/claude/plugin/`): `bcms-best-practices/SKILL.md` is a **symlink** to the canonical skill; `references` symlink unchanged; plugin metadata version **1.1.0**.
- **`ai/README.md`**: consolidated layout, symlink note for Windows.

### Fixed

- Plugin `references` symlink path (five `..` segments to `ai/references/`).
- **`skills/bcms/references`**: entire directory symlinked to `ai/references/` so `references/*.md` paths in the canonical skill resolve for every guide (not only `mcp.md`).

## [1.0.0] — prior

Initial skill pack (`1.0.0`), `references/*.md`, and plugin layout without the 1.1 consolidation (canonical skill symlink, `bcms-mcp`, `mcp.md`, `scripts/`, `AGENTS.md`).
