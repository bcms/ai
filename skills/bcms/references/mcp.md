# BCMS Model Context Protocol (MCP)

**Source of truth for the live tool surface:** [BCMS MCP docs](https://thebcms.com/docs/mcp) · broader docs: [thebcms.com/docs](https://thebcms.com/docs) · setup: [thebcms.com/agents](https://thebcms.com/agents).

This file is **agent guidance**: connection gotchas, payload shapes, and MCP vs SDK routing. It is **not** a maintained inventory of every tool. When tools are configured, **discover names and input schemas from the live MCP client** (and the docs URL above). Do not invent tools from memory or from an outdated list in this pack.

BCMS exposes an MCP server so coding assistants can read and mutate **content and schema** with an **MCP key**. Use MCP when the agent has BCMS tools configured; use `@thebcms/client` (with scoped **API keys**) inside applications, CI, and server code.

## Enabling MCP keys

1. In the BCMS dashboard, create or use an **MCP key** for the project.
2. The credential string format is `keyId.secret.instanceId`. Pass it only as the **`mcpKey`** query parameter on the MCP URL — do **not** call this an API key in MCP setup, and do not put it in `apiKey=` query params.
3. Keep it in environment variables or secure local / user MCP config — never commit it.

Access model (easy to get wrong):

- MCP keys are **per-project**. They are **not** scoped (no per-template / per-media least privilege).
- An MCP key generally can access **all entries, templates, groups, widgets, and media** in that project.
- The MCP layer exposes the **full tool set** for that project. Treat the key as a powerful project credential: rotate if leaked; never ship it to browsers, public repos, or client bundles.
- **API keys** used by the SDK/CLI are a different concern — those *can* be scoped. See `references/permissions.md`.

## Client configuration

Endpoint pattern (param is **`mcpKey`**, not `apiKey`):

```json
{
  "mcpServers": {
    "bcms": {
      "url": "https://app.thebcms.com/api/v3/mcp?mcpKey=YOUR_MCP_KEY_HERE"
    }
  }
}
```

- Path: **`/api/v3/mcp`**. Replace the host if the org uses a custom app URL.
- Prefer env-based URLs so keys never land in git: e.g. expand `BCMS_MCP_KEY` into the query string where the client supports it; otherwise keep the URL in **user** MCP config or a secret manager.

## Transport and sessions

- **Streamable HTTP**.
- First request: **`initialize`** → server returns **`mcp-session-id`**.
- Every follow-up in that session must send the **`mcp-session-id`** header. Missing/expired session → re-initialize.
- Most clients handle the header automatically; on session errors, discard the id and start over.

## HTTP / tool errors

| Situation | Typical cause | What to do |
|-----------|----------------|------------|
| **400** at connect | Key not three dot-separated parts | Use full `keyId.secret.instanceId` |
| **401** at connect | Wrong MCP key or secret | Fix/rotate in dashboard |
| **403** at connect | Credential is not a valid MCP key / MCP not enabled for it | Use an MCP key from the dashboard |
| **404** at connect | Bad `instanceId` segment | Check the key |
| Missing `mcpKey` | Query param omitted | Add `?mcpKey=...` |
| Session / stream errors | Missing/expired `mcp-session-id` or proxy stripping headers | Re-initialize; ensure header on follow-ups |
| Tool returns `error` object | Downstream validation / not-found / etc. | Read `structuredContent.error` (status/message) |

Tool results are wrapped: success `{ data }`, failure `{ error: { status, message } }`. Server-side tool failures often still return HTTP 200 with an `error` payload — inspect the body, not only the status code.

## Capabilities (domains, not a tool catalog)

Expect full CRUD over content **and** schema when MCP is connected, plus supporting domains. Exact tool names and args: **live client schemas** and [docs/mcp](https://thebcms.com/docs/mcp).

Typical domains:

- **Entries** — list, read, create, update, delete
- **Templates, groups, widgets** — list, read, create, update, delete
- **Entry statuses** and **entry history**
- **Languages** — list available/added, add, update, delete
- **Media** — list items/folders, create folders, **pre-signed upload URL** for files (no base64 upload tool; no media-file delete tool in the usual set)
- **Pointer links** — resolve internal entry/media pointer strings for rich-text links
- **Trash** — list/read trashed items

Tool names are fixed **kebab-case**; IDs are **arguments**, not encoded in the tool name.

## MCP resources (load when composing payloads)

The server registers read-only resources (often under `<app-host>/mcp-resources/*.md`). Prefer these over guessing:

| Resource (name may vary slightly) | Use for |
|-----------------------------------|---------|
| Entry | Entry shape (status / meta / content) + live Entry JSON schema |
| Important | If an MCP op errors, do **not** silently fall back to the SDK or CLI |
| Update Instructions | How to use `propChanges` on templates / groups / widgets |

## Entry payloads: meta, content, statuses

- **statuses** — per-locale `{ lng, id }` where `id` is an entry-status ID
- **meta** — structured, per-locale; shape from the template
- **content** — per-locale rich text as a **node tree**

Each content / rich-text value is typically:

```jsonc
{
  "lng": "en",
  "plainText": "",      // system-populated; send empty string
  "nodes": [ /* content nodes */ ]
}
```

Follow the live tool input schema and the Entry resource.

### Rich-text node trees (agent gotchas)

Accepted **node types** (easy to get wrong):

`paragraph`, `heading`, `text`, `bulletList`, `orderedList`, `listItem`, `codeBlock`, `hardBreak`, `horizontalRule`, `widget`, `media`.

Text **marks**: `bold`, `italic`, `underline`, `strike`, `inlineCode`, `link`.

There is **no** `image` or `blockquote` node — use **`media`** for images; use heading/paragraph for callouts.

Useful `attrs`:

- `heading` → `{ "level": 1-6 }`
- `orderedList` → `{ "start": 1 }`
- `listItem` → `{ "list": true }`
- `codeBlock` → `{ "language": "...", "code": "..." }`
- `media` → `{ "mediaId": "...", "altText": "...", "caption": "..." }`
- `widget` → `{ "data": { "_id": "<widgetId>", "props": [...] } }`
- `link` mark → `{ "href": "...", "target": "...", "rel": "..." }`

### Internal links in rich text

For `link` marks, `href` must be a BCMS **pointer string**, not a `/slug` path. Resolve with the pointer-link tools (discover exact names from the client; commonly entry- and media-pointer helpers):

- Entry pointers look like `entry:<entryId>@*_<templateId>:entry`
- External links use normal `https://...` / `mailto:...`

### Minimal examples

```json
{ "type": "paragraph", "content": [{ "type": "text", "text": "Hello" }] }
```

```json
{
  "type": "heading",
  "attrs": { "level": 2 },
  "content": [{ "type": "text", "text": "Section title" }]
}
```

## Updating schema with `propChanges`

Template / group / widget updates use a **`propChanges`** array (add / update / remove props). Property `type` values include `STRING`, `NUMBER`, `BOOLEAN`, `DATE`, `ENUMERATION`, `ENTRY_POINTER`, `GROUP_POINTER`, `MEDIA`, `RICH_TEXT`. Load the **Update Instructions** resource for worked examples; do not invent `data` blocks from memory.

## Workflows (goals — discover tools as you go)

**Discover** — instance details, then templates (and groups/widgets if needed), then entries for a template.

**Create → publish** — list entry statuses (IDs are instance-specific); create with draft status; update to published when ready.

**Rich text with internal link** — resolve pointer link for target; put returned string in `link` mark `href`.

**Upload media** — request pre-signed upload URL; `POST` file as form-data (optional parent folder); use returned media id.

**Delete content or schema** — check usage / impact first; deletes are destructive; confirm with a read/list afterward.

## Dashboard URLs for entries (show users)

When MCP creates or returns an entry, **prefer any `dashboardUrl` field** on the tool result and surface it so the user can open the entry in the browser. Offering the link is encouraged, not mandatory.

If the field is missing (older MCP), the dashboard path is:

```text
https://app.thebcms.com/d/i/{instanceId}/bcms/template/{templateId}/entry/{entryId}
```

- `instanceId` — third segment of the MCP key (`keyId.secret.instanceId`), or `instanceId` on the entry
- `templateId` / `entryId` — from the create/get/update result (`templateId`, `_id`)
- Replace the host if the org uses a custom BCMS app URL

Do **not** confuse this with rich-text **pointer** links (`entry:…@*_…:entry` from pointer-link tools) — those are for content marks, not browser navigation.

## MCP vs `@thebcms/client`

| Use MCP | Use SDK / REST |
|--------|----------------|
| Agent editing content/schema from the IDE | App runtime, SSR, builds |
| Exploratory listing and assisted updates | Owned TypeScript batch jobs |
| BCMS MCP tools are enabled (**MCP key**) | Automation with scoped **API keys**, without MCP |

Same project either way — pick the surface that matches where the work runs. For scripted terminal/CI ops without MCP, see the **`bcms-content`** CLI skill (API key via `BCMS_API_KEY`).
