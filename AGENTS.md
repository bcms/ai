# BCMS `ai/` — notes for agents and automation

This folder is the **BCMS AI skill pack**: guidance for coding agents (Cursor, Claude Code, etc.) and optional local tooling. It is the **source of truth** for skill versions, install commands, reference files, plugin packaging, client compatibility, the `bcms-content` CLI, downloadable skill artifacts, and agent-facing release metadata. `bcms/site` consumes the generated release manifest — never duplicate versions or install commands by hand elsewhere.

## Install (skills.sh)

```bash
npx skills add bcms/ai --skill bcms          # guidance (SDK + modeling + MCP)
npx skills add bcms/ai --skill bcms-content  # executable content CLI
```

ClawHub / OpenClaw: `openclaw skills install @bcms/bcms` and `openclaw skills install @bcms/bcms-content`.

## Layout

| Path | Role |
|------|------|
| `catalog.json` | **Canonical metadata source**: versions (pack, skills, plugins, CLI), install commands, registry URLs, publication status, client support labels, MCP metadata. Edit versions here first. |
| `skills/bcms/SKILL.md` | **Canonical** BCMS skill (~500 lines). Edit here. Skill name: `bcms`. Covers SDK building **and** MCP content operations. |
| `skills/bcms-content/SKILL.md` | **Canonical** `bcms-content` skill. Edit here. Executable content CLI (`cli/bcms.mjs` + `package.json`, dep `@thebcms/client`) for entry/media ops via `BCMS_API_KEY`. Machine mode: `--json`, `--yes`, `--dry-run`. |
| `skills/bcms-content/test/` | CLI tests (mocked `@thebcms/client`; optional integration path gated on `BCMS_TEST_API_KEY`). |
| `skills/bundle.json` | Maps each skill to reference files copied into `skills/<skill>/references/`. |
| `references/*.md` | **Canonical** deep dives — edit here, then run sync. |
| `scripts/sync-skill-references.mjs` | Copies bundled references into skill folders for skills.sh / ClawHub (`--check` for CI). |
| `scripts/validate-skills.mjs` | Bundle coverage, frontmatter versions vs catalog, broken/escaping relative links, unreferenced references. |
| `scripts/validate-catalog.mjs` | Version consistency across every manifest, changelog headings, install-command shape, support-claim backing. |
| `scripts/validate-cursor-plugin.mjs` / `scripts/validate-claude-plugin.mjs` | Plugin package validation (manifests, files, symlinks, versions). |
| `scripts/scan-secrets.mjs` | Secret scanning over skills, references, plugins, scripts, and generated artifacts. |
| `scripts/package-plugins.mjs` | **Copy-mode packaging** → `dist/packages/{cursor,claude}/` (symlinks materialised; use these trees when publishing from Windows). |
| `scripts/build-agent-resources.mjs` | Builds `dist/agent-resources/` (release manifest, skills index, versioned archives, checksums). `--check` detects staleness. |
| `scripts/validate-release.mjs` | Full release gate (`npm run validate:release`); `--online` also HEAD-checks published registry URLs. |
| `scripts/` | Also: SDK examples (`init-client.ts`, etc.). |
| `providers/claude/plugin/` | Claude Code plugin: symlinks to canonical skill + `references/`. |
| `providers/cursor/plugin/` | Cursor plugin: same symlink pattern; see `.cursor-plugin/marketplace.json`. |
| `.cursor-plugin/marketplace.json` | Cursor marketplace manifest. |
| `.claude-plugin/marketplace.json` | Claude Code marketplace manifest (plugin source: `./providers/claude/plugin`). |
| `dist/agent-resources/` | **Generated, committed** release output consumed by `bcms/site`: `release-manifest.json`, `agent-skills-index.json`, `artifacts/*.zip`, `checksums.json`. Rebuild with `npm run package`. |
| `CHANGELOG.md` | Version history of this pack. Every released pack version needs a `## [x.y.z]` heading. |

## Versioning

One canonical version per distributable unit, all declared in `catalog.json`:

- **`packVersion`** — the release train; must match the root `package.json`, both plugin `plugin.json` files, both marketplace manifests, and a `CHANGELOG.md` heading.
- **`skills.bcms.version`** — must match `skills/bcms/SKILL.md` frontmatter (tracks `packVersion`).
- **`skills.bcms-content.version`** / **`cli.version`** — must match `skills/bcms-content/SKILL.md` frontmatter and `skills/bcms-content/package.json`.

`node scripts/validate-catalog.mjs` fails CI on any drift. Never hand-edit versions in generated or downstream files without updating `catalog.json` first.

## Commands (root `package.json`)

```bash
npm run sync              # copy canonical references into skill folders
npm run check             # sync --check + skill validation (links, versions, bundles)
npm run package           # rebuild dist/agent-resources/ + dist/packages/ (copy-mode plugins)
npm run validate          # catalog + skills + both plugins + secret scan
npm run validate:release  # the full release gate (run in CI)
npm test                  # CLI tests (mocked client; no credentials needed)
npm run test:integration  # optional; needs BCMS_TEST_API_KEY + BCMS_TEST_TEMPLATE
```

## Release workflow

1. Edit canonical sources (`skills/*/SKILL.md`, `references/*.md`, CLI).
2. Bump versions in `catalog.json`; mirror in `SKILL.md` frontmatter, plugin manifests, marketplace manifests, root + CLI `package.json` (the catalog validator tells you exactly what disagrees).
3. Add a `## [x.y.z]` heading to `CHANGELOG.md`.
4. `npm run sync && npm run package`.
5. `npm run validate:release` — must pass.
6. Commit canonical sources **and** generated files (`skills/*/references/`, `dist/agent-resources/`).

`bcms/site` reads `dist/agent-resources/release-manifest.json` (via the raw GitHub URL in `catalog.json` → `distBaseUrl`); it must never parse skill sources or invent versions. `agent-skills-index.json` is shaped for a future `/.well-known/agent-skills/index.json` on the website — this repo does not host it.

## Skill reference sync

skills.sh installs each skill folder from GitHub. Reference files must live **inside** the skill directory (`references/mcp.md`, not `../../references/mcp.md`). Relative links must never escape the skill folder — the validator fails on links like `../../scripts/...`; use absolute GitHub URLs instead.

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

On **Windows**, or anywhere symlinks are unavailable, do not copy files by hand: run `node scripts/package-plugins.mjs` and publish the materialised trees from `dist/packages/{cursor,claude}/`.

## Client compatibility

Support labels live in `catalog.json` (`clients` section) and flow into the release manifest. Allowed labels: `tested`, `packaged`, `published`, `documented`, `experimental`, `unsupported`. Keep claims accurate — a package that exists in-repo but is not listed in a public directory is `packaged`, not `published`. Never write vague claims like "works with every agent".

## MCP vs SDK

- **MCP** (remote BCMS tools): see `references/mcp.md` — session header, env-based URL, pointer links for internal entry/media links.
- **SDK** (`@thebcms/client`): see `references/framework-next.md` / `references/framework-astro.md` (and the other `references/framework-*.md` guides) plus `scripts/` for minimal examples.
- **CLI** (`bcms-content`): scripted entry/media operations with stable JSON output; see `skills/bcms-content/SKILL.md`.

## External dependencies (not implemented here)

Owned by the BCMS backend/dashboard or the website repo, tracked as external work:

- Bearer-token MCP authentication, OAuth, MCP Registry server registration, MCP action history, entry-level agent identity, dashboard approval workflows, product analytics events (backend/dashboard).
- `/llms.txt`, `/agents` page, `/.well-known/agent-skills/index.json` hosting, sitemap/robots/HTML metadata (website — consumes `dist/agent-resources/` from this repo).
