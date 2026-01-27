## BCMS API Basics

This document expands on the high‑level notes from `SKILL.md` and focuses on:

- API key structure and environments
- Client initialisation options
- Recommended security practices

### API keys and environments

- Each API key consists of a **public ID** and a **secret**.
- Create **separate keys per environment** (development, staging, production).
- Use dedicated **media keys** for public image delivery when possible.

Store secrets in environment variables, for example:

- `BCMS_ORG_ID`
- `BCMS_INSTANCE_ID`
- `BCMS_API_KEY_ID`
- `BCMS_API_KEY_SECRET`

Never commit these values to source control.

### Client initialisation

The official SDK is `@thebcms/client`. Common options:

- `injectSvg`: inline SVG icons directly into returned HTML.
- `useMemCache`: enable in‑memory caching of responses.
- `enableSocket`: toggle real‑time updates over websockets.

See `SKILL.md` for a concise example and use it as the canonical pattern for new integrations.

### General best‑practices

- Rotate API keys regularly.
- Scope keys to the minimum templates/functions/media required.
- Use HTTPS only and validate TLS certificates in production.

Refer to the official BCMS documentation for the latest details on authentication and client configuration.
