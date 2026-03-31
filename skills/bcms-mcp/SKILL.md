---
name: bcms-mcp
description: Use when the user works with the BCMS MCP remote server only (session, tools, entries, media). Load references/mcp.md for full protocol, errors, and recipes.
---

# BCMS MCP (remote server)

For **session lifecycle**, **environment configuration**, **tool naming**, **pagination**, **ProseMirror / pointer links**, and **troubleshooting**, read the full guide:

**[`references/mcp.md`](../../references/mcp.md)**

Use the **pointer link** tools from the MCP server for internal BCMS links in rich text (`entry:…`, `media:…`); do not invent slug URLs for entry targets.

For **any supported framework** (Next.js, Nuxt, Astro, Svelte, Gatsby, Vite, and the rest of the stacks in [`references/frameworks.md`](../../references/frameworks.md)) and for **`@thebcms/client` SDK** usage, use the **`bcms`** skill (`skills/bcms/SKILL.md`) instead of this MCP-only skill.
