---
name: bcms
version: 1.4.2
description: >
  Required when building with @thebcms/client or operating BCMS content/schema via MCP.
  Use for content modeling, framework apps (Next.js, Nuxt, Astro, Svelte, Gatsby, Vite),
  and agent-driven entry, media, or schema work. Routes SDK vs MCP vs the bcms-content CLI,
  secrets/least-privilege, and progressive references (templates, entries, properties, MCP).
---

# BCMS

**Canonical copy:** edit this file at `ai/skills/bcms/SKILL.md`. Claude Code and Cursor plugins package it via symlinks under `ai/providers/*/plugin/skills/bcms/` (see `ai/AGENTS.md`). On Windows without symlinks, use `npm run package` and publish from `dist/packages/`.

This skill is a **router**: keep it loaded for goals and constraints; open files under `references/` only when that topic is needed. Prefer official docs for volatile API surface: [thebcms.com/docs](https://thebcms.com/docs) · [MCP](https://thebcms.com/docs/mcp) · [agents setup](https://thebcms.com/agents).

## Mode router

This skill (`bcms`) is **guidance**. The companion **`bcms-content`** skill is an **executable CLI**. They are not interchangeable.

| You want to… | Use |
|---|---|
| Model content, integrate a framework, write app code | This skill + `@thebcms/client` SDK |
| Operate content/schema interactively with BCMS tools configured | **MCP** — `references/mcp.md` |
| Scripted, deterministic entry/media ops in terminal, CI, or agent loops | **`bcms-content`** CLI (`npx skills add bcms/ai --skill bcms-content`) |
| Fetch or mutate content from application code, builds, or servers | **SDK** (`@thebcms/client`) |

## Open the right reference

| Topic | Load |
|---|---|
| Client init, env keys, API basics | `references/bcms-api-basics.md` |
| Templates | `references/templates.md` |
| Entries (CRUD, locales) | `references/entries.md` |
| Groups | `references/groups.md` |
| Widgets | `references/widgets.md` |
| Media | `references/media.md` |
| Property / field types | `references/properties.md` |
| Functions & webhooks | `references/functions-webhooks.md` |
| Permissions & key scopes | `references/permissions.md` |
| Framework pick → per-framework guide | `references/frameworks.md` |
| MCP tools, session, pointer links, rich-text nodes | `references/mcp.md` |

## Principles

- **Latest stack** unless the user pins older packages. Generated types usually live under `bcms/types/ts` after `bcms --pull types`; some projects import `@thebcms/types` or an alias — match the repo.
- **Model with BCMS primitives**: templates + entries first; groups for reusable structures; widgets for rich-text blocks; media library for files.
- **Prefer official starters** (`@thebcms/cli`) before hand-rolling; then `references/frameworks.md`.
- **Render with BCMS components** (`BCMSContentManager`, `BCMSImage` / framework equivalents) instead of custom rich-text parsers unless there is a clear need.
- **Secrets**: three-part key `keyId.secret.instanceId` in env (`BCMS_API_KEY`, plus public key vars where framework docs require); separate keys per env; least privilege — especially for media delivery.
- **Localisation**: `meta` / `content` per locale when multi-lingual.
- **Evolve schemas**; avoid destructive production changes without migration.
- **MCP when tools exist**: use MCP for interactive content/schema ops; use the SDK in app code, builds, and anything outside MCP.

## Constraints (do / don't)

- **Never** hard-code API keys or use admin keys in the browser — env + minimally scoped keys (`references/bcms-api-basics.md`, `references/permissions.md`).
- **Never** ship MCP keys to browsers, public repos, or client bundles.
- **Never** delete templates, groups, widgets, or media in production without checking impact (`whereIsItUsed` / usage first).
- **Don't** stuff unstructured JSON into `meta`/`content` when a property, group, or widget fits.
- **Don't** re-implement rich-text/widget rendering when `BCMSContentManager` is available.
- **Don't** expose write-capable keys to public clients — mutations stay server-side or in functions.
- **Don't** skip webhook signature/timestamp checks; handlers must be idempotent (`references/functions-webhooks.md`).

## MCP (essentials only)

Official: [thebcms.com/docs/mcp](https://thebcms.com/docs/mcp). Agent gotchas and payload shapes: **`references/mcp.md`** (discover live tool names/schemas from the MCP client — not a hand-maintained tool catalog).

Agent-only gotchas (easy to get wrong):

- URL: `https://app.thebcms.com/api/v3/mcp?mcpKey=<keyId.secret.instanceId>` (param is **`mcpKey`**; custom app host if needed).
- Key must have the **MCP flag** or the endpoint returns `403`.
- Streamable HTTP; after `initialize`, clients must send **`mcp-session-id`** on follow-ups.
- Fixed **kebab-case** tools; IDs are arguments, not part of tool names. MCP-enabled keys see the full tool set — treat the key as write-capable.
- Rich text is a **node tree** (`paragraph`, `heading`, lists, `text`, `widget`, `media`, … — **no** `image` node). Internal links: **`get-entry-pointer-link`** / **`get-media-pointer-link`**.

## Client initialization (durable pattern)

Env-held three-part key; options-only `Client` (matches current integration docs):

```ts
import { Client } from '@thebcms/client';

export const bcmsPrivate = new Client({ injectSvg: true }); // reads BCMS_API_KEY

export const bcmsPublic = new Client({
  apiKey: process.env.NEXT_PUBLIC_BCMS_API_KEY,
  injectSvg: true,
});
```

Scripts/servers: see [`ai/scripts/init-client.ts`](https://github.com/bcms/ai/blob/main/scripts/init-client.ts) and `references/bcms-api-basics.md`.

## Done looks like (self-verify)

Stop when the goal matches one of these — verify before claiming success:

| Goal | Verify |
|---|---|
| Framework / SDK integrate | Client constructs; types resolve (or documented import path); one successful entry or template read |
| Content model change | Template/group/widget matches intent; required props present; no silent destructive delete |
| MCP content write | Read-back via get/list tools shows expected `meta`/`content` (or statuses) |
| MCP / schema delete | Usage checked first; target gone on read-back; dependents accounted for |
| Permissions / keys | Key lives only in env/user MCP config; scopes match the operation; no key in git or client bundles |

On errors: check URL/host, MCP flag / session header, and key scopes before rewriting approach.

## Improve this skill

After a confusing failure, missing gotcha, or outdated instruction, propose a concrete edit to this file or the relevant `references/*.md` (and a catalog/changelog bump if releasing) instead of only patching the one-off task.

Repo automation notes: **`ai/AGENTS.md`**. Pack history: **`ai/CHANGELOG.md`**.
