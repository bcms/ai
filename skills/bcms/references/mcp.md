# BCMS Model Context Protocol (MCP)

Official documentation: [BCMS docs](https://thebcms.com/docs) · [MCP guide](https://thebcms.com/docs/mcp)

BCMS exposes an **MCP server** so coding assistants (Cursor, Claude Code, etc.) can read and mutate **content** (entries, media metadata) using a dedicated API key. MCP complements the **`@thebcms/client` SDK**: use MCP when the agent has MCP tools configured; use the SDK inside applications, CI, and server code.

## Enabling MCP and keys

1. In the BCMS dashboard go to **Settings → MCP** (or create an API key with MCP enabled).
2. Create or edit an API key and turn on **MCP access**.
3. Scope the key with **least privilege**:
   - Per **template**: the UI may list **GET / POST / PUT / DELETE**; [official MCP documentation](https://thebcms.com/docs/mcp) states that **MCP currently supports creating, reading, and updating content only**—do not rely on entry delete via MCP even if DELETE appears in key settings.
   - **Media**: read vs mutate as required (folders and uploads need mutation where applicable).

The key format is the same three-part API key as the REST client (`keyId.keySecret.instanceId`). Keys **without** the MCP flag are rejected by the MCP endpoint (`403` — key does not have MCP access).

## Client configuration (Cursor, Claude, etc.)

Point your MCP client at the BCMS MCP URL with the key as a query parameter:

```json
{
  "mcpServers": {
    "bcms": {
      "url": "https://app.thebcms.com/api/v3/mcp?mcpKey=YOUR_MCP_KEY_HERE"
    }
  }
}
```

Replace the host if your organization uses a custom BCMS app URL. Keep the key in **environment variables** or secure config — never commit it.

### Environment-based URL (recommended)

Avoid pasting the key into JSON checked into git. Examples:

- **Shell**: `export BCMS_MCP_KEY='keyId.secret.instanceId'` then substitute in your client config if it supports variable expansion, or paste only locally.
- **Cursor / VS Code**: use `mcp.json` in user config (not the repo) or a secret manager; the URL is always `https://<app-host>/api/v3/mcp?apiKey=<three-part-key>`.

If your MCP client does not expand env vars, generate the full URL at runtime or use a small wrapper script—never commit the literal key.

## Transport and sessions

- The server uses **Streamable HTTP** (MCP over HTTP).
- After initialization, clients should send the **`mcp-session-id`** header on subsequent requests so the session stays valid.
- If the session expires, re-run the MCP **initialize** flow.

### Session lifecycle (mental model)

1. Client opens a connection to the MCP URL (with `apiKey` query param).
2. Client sends **`initialize`**; server responds with capabilities and may establish a session.
3. Every subsequent HTTP request in that session includes **`mcp-session-id`** (value from the protocol handshake—your client usually handles this).
4. On **401/403** or “session invalid” behavior, discard the session id and repeat from step 2.
5. Long idle periods may require re-initialization; treat intermittent failures as “re-init first.”

## HTTP errors and what they usually mean

| Situation | Typical cause | What to do |
|-----------|----------------|------------|
| **403** right away | Key missing **MCP** flag, wrong key format, or wrong instance segment | Enable MCP on the key in the dashboard; verify `keyId.secret.instanceId` |
| **403** on a tool call | Template or media **scope** missing (GET/POST/PUT) | Edit key scopes for that template or media mutation |
| **401** | Invalid or revoked key | Rotate key; fix env/config |
| Tool missing in UI | Key cannot **see** that template | Grant template access on the key |
| Empty or partial tool list | Normal: only templates you scoped appear | Use `list_templates_and_entries` to see what the key exposes |
| Session / stream errors | Missing **`mcp-session-id`**, expired session, or proxy stripping headers | Re-initialize; ensure client sends session header on follow-ups |

Official product behavior can evolve; when in doubt, cross-check [thebcms.com/docs/mcp](https://thebcms.com/docs/mcp).

## What MCP can and cannot do

**In scope (typical):**

- List templates and entry summaries; list entries per template.
- **Create** and **update** entries (when the key has POST/PUT on that template).
- List media and media directories; resolve **entry** and **media pointer** strings for rich-text links.
- Optionally create media directories and obtain an **upload URL** for large files (when media mutation is allowed).

**Not exposed as MCP tools in typical server builds (verify your client’s tool list):**

- **Deleting** entries via MCP (use the dashboard or REST/SDK if your key allows it)—despite DELETE toggles in key UI; see [thebcms.com/docs/mcp](https://thebcms.com/docs/mcp).
- Creating or editing **templates, groups, or widgets** (schema design stays in the dashboard).

If a tool is missing from the client’s tool list, assume the API key lacks the matching template or media scope.

## Tool names (as registered by the server)

Naming is **mixed** (underscores vs hyphens). Match the names your client actually lists.

| Tool | Purpose |
|------|--------|
| `list_templates_and_entries` | Overview of templates and their entries |
| `list_entries_for_{templateId}` | Entries for one template (`templateId` is the Mongo-style template `_id`) |
| `create_entry_for_{templateId}` | Create entry (requires POST scope on that template) |
| `update_entry_for_{templateId}` | Update entry (requires PUT scope on that template) |
| `list_all_media` | Media library items |
| `list_media_dirs` | Folder tree |
| `create-media-directory` | Create a folder (requires media mutation) |
| `upload-media-file` | Documented on [thebcms.com/docs/mcp](https://thebcms.com/docs/mcp): upload via **base64** payload (check your client for exact args) |
| `request-upload-media-url` | Some deployments expose this instead: pre-signed **POST** URL for large files (avoids huge tool payloads) |
| `get_entry_pointer_link` | Build internal entry pointer for rich-text `link` nodes |
| `get_media_pointer_link` | Build internal media pointer for rich-text `link` nodes |

Per-template tools appear **only** for templates the key can access.

## Entry payloads: meta, content, statuses

- **Meta** and **content** follow the template schema (groups, widgets, localized fields).
- **Content** is represented as **node trees** matching the [MCP content structure](https://thebcms.com/docs/mcp): `paragraph`, `heading`, `bulletList` / `orderedList`, `listItem`, `text` (with optional marks such as `bold`, `link`), `codeBlock`, `blockquote`, **`image`**, `widget`, etc. (Use the tool/schema your client shows—names can evolve.)
- **Internal links** in rich text must use BCMS pointer formats (use the `get_*_pointer_link` tools rather than inventing paths). External URLs use normal `https://` (or `mailto:`) link targets.
- Set **status** per locale where the template defines statuses (published vs draft IDs depend on the instance).

Follow each tool’s input schema in the client; it is generated from the live template and is the source of truth.

### Pagination and limits

- Large instances may return **many** entries or media items. Prefer **template-scoped** `list_entries_for_*` over dumping everything when possible.
- If the client or tool exposes **`limit`** / **`offset`** (or equivalent), use them for incremental reads.
- For **uploads**, use **`upload-media-file`** or **`request-upload-media-url`** depending on which tool your MCP client lists; large files usually fit the pre-signed URL flow when available.

### Minimal ProseMirror shapes (for agents)

Use the tool schema as the authority; these are illustrative only:

```json
{
  "type": "paragraph",
  "content": [{ "type": "text", "text": "Hello" }]
}
```

```json
{
  "type": "heading",
  "attrs": { "level": 2 },
  "content": [{ "type": "text", "text": "Section title" }]
}
```

Internal links: build `href` with **`get_entry_pointer_link`** / **`get_media_pointer_link`**; external links use `https://...` or `mailto:...`.

## Recipes (agent workflows)

**Discover what the key can do**

1. Call `list_templates_and_entries`.
2. For each template you need, call `list_entries_for_{templateId}` (or the tool name your client shows).

**Draft → publish pattern**

1. List entries; pick `entryId` and note status IDs from the template (published vs draft—IDs are instance-specific).
2. `update_entry_for_{templateId}` with `status` set to draft while iterating on `meta` / `content`.
3. When ready, same tool with published status id for the relevant locale(s).

**New entry with title + slug**

1. Read the create tool’s required `meta` fields from the schema (often `title`, `slug`, pointers, media).
2. `create_entry_for_{templateId}` with minimal valid `meta`, empty or stub `content` if allowed, then follow up with `update_entry_for_{templateId}` to flesh out rich text.

**Rich text with an internal link**

1. `get_entry_pointer_link` / `get_media_pointer_link` for the target.
2. In a `text` node, add a `link` mark whose `attrs.href` is that pointer string (see tool docs for exact format).

## Security and troubleshooting

- **Rotate keys** if leaked; treat MCP keys like full API keys for the scopes you granted.
- **Invalid key format** → three segments separated by dots; missing MCP flag → `403`.
- **Template access errors** → check GET/POST/PUT scopes for that template on the key.
- **Session errors** → re-initialize and ensure `mcp-session-id` is sent after the first request.

## Choosing MCP vs `@thebcms/client`

| Use MCP | Use SDK / REST |
|--------|----------------|
| Agent is editing content from the IDE | Application runtime, SSR, builds |
| Exploratory listing and scripted content updates | Batch jobs you own in TypeScript |
| Assistant has BCMS MCP tools enabled | Custom automation without MCP |

Schema changes (new templates, properties, groups) remain **dashboard** workflows; then regenerate types and use SDK or MCP against the new shape.
