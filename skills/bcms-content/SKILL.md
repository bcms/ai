---
name: bcms-content
version: 1.1.3
description: >
  Required for scripted BCMS entry and media operations in a terminal, CI, or agent loop
  when MCP is unavailable or a deterministic CLI is preferred. Use to create, update,
  delete, or list entries and upload media with stable --json output and a scoped
  three-part API key (BCMS_API_KEY). Not for application SDK code, content modeling, or
  interactive MCP (that uses a per-project MCP key) — use the companion bcms skill.
---

# BCMS Content CLI

**Canonical copy:** edit this file at `ai/skills/bcms-content/SKILL.md`. The Claude Code and Cursor plugins package the same file via symlinks under `ai/providers/*/plugin/skills/bcms-content/`.

This skill ships a small executable CLI (`cli/bcms.mjs`) for **content operations**: create / update / delete / list entries and upload media. It wraps the official **`@thebcms/client`** SDK so entry `meta` is converted to the raw props the backend expects (raw REST calls do not do this).

For content **modeling**, SDK usage in application code, framework integrations, and the MCP server, use the companion **`bcms`** skill. Use this `bcms-content` skill when you want to *run a command and get a result* rather than write app code.

**Setup guide:** [thebcms.com/agents](https://thebcms.com/agents) — MCP connection, skill install, and CLI examples.

## Setup (once)

1. **Install dependencies** in this skill folder (it has its own `package.json` with one dependency):

```bash
npm install
```

2. **Provide an API key** — three-part `keyId.secret.instanceId` in `BCMS_API_KEY`. This is an **API key** and can be scoped to the templates/media you need (`references/permissions.md`).

```bash
export BCMS_API_KEY="keyId.secret.instanceId"
# Optional, only for self-hosted / custom app origins:
export BCMS_API_ORIGIN="https://app.thebcms.com"
```

> Do **not** confuse this with MCP. Interactive MCP uses an **MCP key** (`mcpKey`) that is **per-project and not scoped**. The CLI uses a scoped **API key**. See `references/mcp.md` and the `bcms` skill.

## Running commands

After `npm install`, run either form:

```bash
node cli/bcms.mjs <command> [args] [flags]
npx bcms-content <command> [args] [flags]
```

Run `node cli/bcms.mjs help` for inline usage.

## Commands

| Command | Purpose |
|---------|---------|
| `create-entry <template> --data '<json>'` | Create an entry in a template (by id or name) |
| `update-entry <entryId> --template <t> --data '<json>'` | Update an entry; stdout returns the **full parsed entry** after the update |
| `delete-entry <entryId> --template <t>` | Delete an entry (irreversible — requires confirmation or `--yes`) |
| `list-entries <template>` | List entry ids for a template (discovery before update/delete) |
| `upload-media <filePath> [--parent <dirId>]` | Upload a file to the media library |

Command flags: `--data '<json>'` (inline) or `--data-file <path>` (from file), `--lng <code>` (default `en`), `--status <id>`, `--template <idOrName>`, `--parent <dirId>`.

Global flags: `--json` (machine mode), `--yes` (skip confirmation), `--dry-run` (preview without mutating).

In **human mode** (the default) commands print a short status line followed by pretty JSON to stdout. `create-entry` and `update-entry` return the **full parsed entry** (`meta`, `content`, `statuses`, `_id`, etc.) so agents see the complete state after the operation. Other commands return a smaller payload (e.g. media `_id`).

## Machine mode (`--json`)

With `--json`, stdout carries **exactly one JSON envelope** and nothing else; all diagnostics go to stderr. The CLI never prompts in JSON mode.

Success:

```json
{ "ok": true, "data": { } }
```

Failure:

```json
{ "ok": false, "error": { "code": "INVALID_ARGUMENT", "message": "Human-readable description", "details": {} } }
```

Error codes: `INVALID_ARGUMENT`, `INVALID_JSON`, `AUTHENTICATION_REQUIRED`, `AUTHENTICATION_FAILED`, `PERMISSION_DENIED`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `NETWORK_ERROR`, `API_ERROR`, `UNSUPPORTED_OPERATION`, `CONFIRMATION_REQUIRED`.

Exit codes (stable):

| Exit | Meaning |
|------|---------|
| 0 | success |
| 1 | unknown / unclassified error |
| 2 | `INVALID_ARGUMENT`, `INVALID_JSON`, `UNSUPPORTED_OPERATION` |
| 3 | `AUTHENTICATION_REQUIRED`, `AUTHENTICATION_FAILED` |
| 4 | `PERMISSION_DENIED` |
| 5 | `NOT_FOUND` |
| 6 | `CONFLICT` |
| 7 | `RATE_LIMITED` |
| 8 | `NETWORK_ERROR` |
| 9 | `API_ERROR` |
| 10 | `CONFIRMATION_REQUIRED` |

API errors are sanitised before printing: the API key, secret query parameters (`mcpKey=`, `apiKey=`, …), and authorization headers are redacted from messages and `details`.

### Destructive commands and `--dry-run`

`delete-entry` is destructive. In an interactive terminal it prompts for confirmation (on stderr); in non-TTY runs and in `--json` mode it **requires `--yes`** and otherwise fails with `CONFIRMATION_REQUIRED` (exit 10). `--dry-run` works on every mutating command (`create-entry`, `update-entry`, `delete-entry`, `upload-media`): it validates inputs and reports the planned operation — including the affected resources for deletes — without calling any mutating API. Dry runs do not verify that the target entry exists.

### Retry safety

| Command | Safe to retry? |
|---------|----------------|
| `list-entries` | Yes — read-only. |
| `update-entry` | Yes — the same payload produces the same result. |
| `delete-entry` | Yes — a repeated delete fails with `NOT_FOUND`; nothing else changes. |
| `create-entry` | **No** — retrying after an ambiguous failure can create duplicates; `list-entries` first. |
| `upload-media` | **No** — retrying can create duplicate media files. |

The BCMS API does not currently accept idempotency keys, so the CLI cannot deduplicate creates on your behalf.

## `--data` shape

Single language, controlled by `--lng` (default `en`):

```jsonc
{
  "meta": { "title": "Hello world", "slug": "hello-world" },  // prop name -> value
  "content": "First paragraph.\n\nSecond paragraph."          // optional
}
```

- **`meta`** keys are the template's property names. Include all **required** props on create. On `update-entry`, partial `--data.meta` is **merged with the existing entry** for the target `--lng` before the API call — omitted keys are preserved, provided keys overwrite. The CLI always sends the complete merged `meta` for that language.
- **`content`** is optional. Pass a **plain string** (blank lines split paragraphs) for simple text, or a raw **`EntryContentNode[]`** array for rich text (headings, lists, media, widgets). On `update-entry`, if `content` is omitted the existing content nodes for that language are preserved and sent in full; if provided, content is replaced.

Rich-text node shape (Tiptap-style trees):

```jsonc
[
  { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Section" }] },
  { "type": "paragraph", "content": [{ "type": "text", "text": "Body text." }] }
]
```

## Examples

```bash
# Create a blog post (plain-text body)
node cli/bcms.mjs create-entry blog \
  --data '{"meta":{"title":"Hello","slug":"hello"},"content":"My first post."}'

# Update only the title (body is preserved; stdout is the full entry JSON)
node cli/bcms.mjs update-entry 663f0a... --template blog \
  --data '{"meta":{"title":"Hello (edited)"}}'

# List entries to find ids (machine mode)
node cli/bcms.mjs list-entries blog --json

# Delete an entry (non-interactive runs need --yes; preview with --dry-run)
node cli/bcms.mjs delete-entry 663f0a... --template blog --yes

# Upload media into a folder
node cli/bcms.mjs upload-media ./hero.png --parent 6640bb...

# Read create data from a file (good for rich content)
node cli/bcms.mjs create-entry blog --data-file ./post.json
```

## CLI vs MCP vs SDK

- **This CLI** — deterministic, scriptable content ops in terminals, CI, and agent loops. One **API key** (`BCMS_API_KEY`), no interactive login.
- **MCP tools** — best when the agent already has BCMS MCP configured with an **MCP key** (per-project, not scoped); full schema-guided CRUD. See the `bcms` skill and `references/mcp.md`.
- **`@thebcms/client` SDK** — for application code, builds, and anything beyond these commands (scoped API keys). See the `bcms` skill.

## Safety

- **Never hard-code or commit API keys.** Use `BCMS_API_KEY` from the environment; prefer least-privilege scoped keys (`references/permissions.md`).
- **`delete-entry` is irreversible.** Confirm the id with `list-entries` first, preview with `--dry-run`, and avoid deletes against production without checking impact. Non-interactive runs must pass `--yes` explicitly.
- The CLI never prints credentials and redacts key-like values from API error output.
- Use separate keys per environment (dev / staging / production).

## Done looks like (self-verify)

| Goal | Verify |
|---|---|
| Create / update entry | Command exit `0`; with `--json`, `ok: true`; stdout/data shows expected `meta` (and `content` if set). Prefer full entry payload from create/update. |
| Delete entry | Previewed with `--dry-run` when unsure; then `--yes` in non-TTY; follow-up `list-entries` / get no longer returns the id (or `NOT_FOUND`). |
| Upload media | Exit `0`; response includes media `_id`; optional parent dir matches `--parent`. |
| Agent / CI loop | Use `--json`; parse one stdout envelope; map exit codes; do not retry `create-entry` / `upload-media` blindly after ambiguous failure. |

## Improve this skill

After a confusing CLI failure, unclear flag, or stale contract detail, propose an edit to this file (or bundled `references/`) rather than only fixing the one-off command.

Deeper references are bundled under `references/` (entries, media, properties, permissions, MCP). Change history: `ai/CHANGELOG.md`.
