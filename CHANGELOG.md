# Changelog — BCMS AI skill pack (`ai/`)

All notable changes to the canonical skill, references, plugin packaging, and local examples are documented here.

## [1.3.2] — 2026-06-09

### Changed

- **`README.md`**, **`skills/bcms/SKILL.md`**, **`skills/bcms-content/SKILL.md`**: link to the agent setup guide at [thebcms.com/agents](https://thebcms.com/agents).

## [1.3.1] — 2026-06-09

### Fixed

- **MCP documentation accuracy pass** — reconciled `references/mcp.md` (and the MCP sections of `skills/bcms/SKILL.md`, `skills/bcms-content/SKILL.md`, and `README.md`) with the live BCMS MCP server:
  - **Delete is available over MCP.** Removed the stale "MCP currently supports create/read/update only" / "treat entry delete as not available" claims. The server exposes full CRUD on entries **and** on templates, groups, and widgets (plus entry statuses, entry history, languages, media, pointer links, and trash).
  - **Tool names corrected** to the real fixed **kebab-case** tools (e.g. `create-entries`, `update-entries`, `delete-entries`, `get-all-entries-by-template-id`, `get-entry-pointer-link`) — IDs are passed as arguments rather than encoded in per-template tool names. Removed the non-existent `upload-media-file` (base64) tool; media files upload via the pre-signed URL from `request-upload-media-url`.
  - **Connection details resolved**: endpoint `/api/v3/mcp`, key query parameter **`mcpKey`** (not `apiKey`), three-part key requiring the **MCP flag** (`403` otherwise), Streamable HTTP transport with the **`mcp-session-id`** header.
  - **Rich text corrected** to the real node/mark sets (no `image` or `blockquote` node — media embeds use the `media` node) and documented the MCP **resources** (`Entry`, `Important`, `Update Instructions`) and the `propChanges` schema-update flow.

## [1.3.0] — 2026-06-09

### Added

- **New executable skill `bcms-content`** (`skills/bcms-content/`): a thin, agent-facing CLI for content operations. Install with `npx skills add bcms/ai --skill bcms-content`.
  - `cli/bcms.mjs` wraps `@thebcms/client` and exposes `create-entry`, `update-entry`, `delete-entry`, `list-entries`, and `upload-media`. Auth via `BCMS_API_KEY` (the same three-part key used for the BCMS MCP). `update-entry` preserves existing content when only `meta` changes; `delete-entry` gives a scriptable CLI path for removing entries.
  - `package.json` declares a single dependency (`@thebcms/client`) and a `bcms-content` bin; the agent runs `npm install` once in the skill folder.
  - `SKILL.md` documents setup, commands, the `--data` JSON shape, rich-text node format, and CLI-vs-MCP-vs-SDK guidance.
- **`skills/bundle.json`**: `bcms-content` entry bundling a focused reference subset (`entries`, `media`, `properties`, `permissions`, `mcp`).
- **Plugins**: `bcms-content` skill symlinks (`SKILL.md` + `references/`) added to both the Cursor and Claude bundles.

### Changed

- **`README.md`**, **`AGENTS.md`**: document the second skill, its install command, the bundled-CLI runtime, and the new plugin symlinks.
- **Plugin manifests**: version bumped to **1.3.0**; descriptions note the executable content CLI.

## [1.2.0] — 2026-06-09

### Changed

- **Single skill**: merged `bcms-best-practices` and `bcms-mcp` into one skill named **`bcms`** (`skills/bcms/SKILL.md`). Install with `npx skills add bcms/ai --skill bcms`. It covers both `@thebcms/client` SDK building and MCP-based content operations; `references/mcp.md` ships in the bundle.
- **`skills/bundle.json`**: single `bcms` entry (`include: ["*"]`).
- **Plugins**: renamed plugin skill folders to `skills/bcms/` in both the Cursor and Claude bundles; removed the standalone `bcms-mcp` plugin skill.
- **`README.md`**, **`AGENTS.md`**, **`providers/cursor/plugin/README.md`**: updated install command and layout to the single-skill model.

### Removed

- **`skills/bcms-mcp/`**: folded into the `bcms` skill.
- Stray `skills/bcms/.git/` GitKraken litter and the committed `skills/bcms/references` symlink (now a real, synced directory).

## [1.1.5] — 2026-06-09

### Added

- **`skills/bundle.json`**: declares which canonical `references/` files each skill ships.
- **`scripts/sync-skill-references.mjs`**: copies bundled references into `skills/*/references/` for skills.sh and ClawHub installs (`--check` for CI).
- **Generated `skills/*/references/`**: committed bundles so `npx skills add bcms/ai --skill <name>` includes reference docs (e.g. `bcms-mcp` ships `references/mcp.md`).

### Changed

- **`skills/bcms-mcp/SKILL.md`**: in-skill links (`references/mcp.md`); points SDK/framework work at `bcms-best-practices` install command.
- **`README.md`**, **`AGENTS.md`**: document per-skill install commands and sync workflow.

## [1.1.4] — 2026-03-31

### Added

- **Cursor plugin**: [`ai/providers/cursor/plugin/`](providers/cursor/plugin/) with `.cursor-plugin/plugin.json`, symlinked `bcms-best-practices` and `bcms-mcp` skills, plugin-root `references` symlink for MCP skill links, [`mcp.json.example`](providers/cursor/plugin/mcp.json.example), and [`providers/cursor/plugin/README.md`](providers/cursor/plugin/README.md).
- **Cursor marketplace manifest**: [`ai/.cursor-plugin/marketplace.json`](.cursor-plugin/marketplace.json) (plugin entries use `name`, `source`, and `description` only, per Cursor schema).
- **Validation**: [`ai/scripts/validate-cursor-plugin.mjs`](scripts/validate-cursor-plugin.mjs) (run from repo root).

### Changed

- **`ai/AGENTS.md`**, **`ai/README.md`**: document Cursor packaging and marketplace path.
- **`skills/bcms-mcp/SKILL.md`**: MCP-only skill defers framework/SDK work to the main `bcms` skill and links [`references/frameworks.md`](references/frameworks.md) for all supported stacks.
- **`skills/bcms/SKILL.md`**: canonical note includes the Cursor plugin symlink path alongside Claude.
- **Cursor `plugin.json`**: keywords and tags for Astro, Gatsby, Next.js, Nuxt, and Svelte.
- **`providers/cursor/plugin/mcp.json.example`** and **README**: `YOUR_BCMS_MCP_KEY` placeholder and user MCP copy instructions.
- **Claude Code plugin** metadata version **1.1.4** (aligned with this release).

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
