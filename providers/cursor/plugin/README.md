# BCMS — Cursor plugin

This folder is the **Cursor** packaging of the BCMS AI skill pack. Canonical skill text lives under [`ai/skills/`](../../skills/) and [`ai/references/`](../../references/).

## Install

1. In Cursor, add this repository as a **plugin marketplace** (or open the `ai/` folder), using the manifest at [`ai/.cursor-plugin/marketplace.json`](../../.cursor-plugin/marketplace.json).
2. Enable the **BCMS** plugin from that marketplace.

Official product docs: [thebcms.com/docs](https://thebcms.com/docs/).

## Layout

| Path | Role |
|------|------|
| `.cursor-plugin/plugin.json` | Cursor plugin manifest |
| `skills/bcms-best-practices/` | Symlinked `SKILL.md` + `references/` → canonical [`skills/bcms`](../../skills/bcms) and [`references/`](../../references/) |
| `skills/bcms-mcp/` | Symlinked thin MCP skill → [`skills/bcms-mcp`](../../skills/bcms-mcp) |
| `references` | Symlink → [`references/`](../../references/) (so `bcms-mcp` relative links resolve) |

On **Windows**, if git or the filesystem does not support symlinks, **copy** the canonical `SKILL.md` files and the `references` directory into these paths when publishing or installing locally.

## BCMS MCP (optional)

Cursor does **not** reliably expand environment variables inside `mcp.json` URLs. Do **not** commit a real API key.

1. Create an API key in the BCMS dashboard with **MCP** enabled and least-privilege template/media scopes.
2. Add an MCP server in **Cursor Settings → MCP** using the URL pattern from [`references/mcp.md`](../../references/mcp.md) (see also [MCP on thebcms.com](https://thebcms.com/docs/mcp)).
3. For a starting point, copy [`mcp.json.example`](./mcp.json.example) into your **user** MCP config, replace `YOUR_BCMS_MCP_KEY` with your BCMS MCP API key, and adjust the host if your org uses a custom app URL.

Full protocol, session headers, and troubleshooting: **`references/mcp.md`** in the repo (or via the bundled skills).

## Maintainer validation

From the `ai/` repo root:

```bash
node scripts/validate-cursor-plugin.mjs
```
