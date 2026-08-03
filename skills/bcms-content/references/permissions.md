## BCMS Permissions

BCMS permissions control what users and **API keys** can do. **MCP keys are different** — see below.

### User permissions

- Users can be granted broad roles or granular rights.
- Only admins should be allowed to create/modify templates, widgets, groups and API keys.

### API key permissions (SDK / CLI / REST)

- Permissions can be configured in **simple** or **advanced** modes.
- In advanced mode you can specify per‑resource rights:

  - `get`
  - `create`
  - `update`
  - `delete`

- API keys can be scoped per template, function and sometimes media operations.
- The `bcms-content` CLI and `@thebcms/client` use **API keys** (`BCMS_API_KEY`). Prefer least privilege for those.

### MCP keys (not scoped)

- MCP authenticates with an **MCP key** (`mcpKey` query param) — do **not** describe MCP as using an API key.
- MCP keys are **per-project**. They are **not** template/media-scoped and are **not** least-privilege in the API-key sense.
- An MCP key generally has access to **all entries, templates, groups, widgets, and media** in that project, with the full MCP tool set.
- Protect MCP keys like project-admin credentials: local/user config only, never browsers or public repos; rotate if leaked.
- Details: `references/mcp.md`.

### Least‑privilege design (API keys)

- Create **separate API keys** for:

  - Public, read‑only content delivery.
  - Internal management tools (may need create/update/delete).
  - Media delivery or uploads.
  - Function invocation.

- Regularly review and rotate keys, revoking those that are no longer needed.
- Do **not** apply “scope the MCP key” advice — scoping does not apply to MCP keys.

When the agent encounters permission errors on **SDK/CLI** calls, it should:

1. Check that the correct API key is being used for the environment.
2. Verify that the API key has the necessary scopes for the operation.
3. Consult organisation administrators if broader rights are required.

MCP connect failures are usually wrong/missing **MCP key** or session header — not missing template scopes.
