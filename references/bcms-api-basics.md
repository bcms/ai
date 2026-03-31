## BCMS API Basics

This document expands on the high‑level notes from `SKILL.md` and focuses on:

- API key structure and environments
- Client initialisation options
- Recommended security practices

### API keys and environments

- Each API key has a **public ID** and a **secret**; together with the instance they are often used as one **three‑part string** `keyId.secret.instanceId` (see [BCMS docs](https://thebcms.com/docs)).
- Create **separate keys per environment** (development, staging, production).
- Use dedicated **media keys** for public image delivery when possible.

**Environment variables** (pick the pattern that matches your integration guide):

- **Single key string** (used in current [Next.js](https://thebcms.com/docs/integrations/next-js) and [Nuxt](https://thebcms.com/docs/integrations/nuxt-js) docs): `BCMS_API_KEY` for the private key; a second env var for the public/media key (e.g. `NEXT_PUBLIC_BCMS_API_KEY`, `NUXT_PUBLIC_BCMS_API_KEY`).
- **Split credentials** (common in scripts): `BCMS_ORG_ID`, `BCMS_INSTANCE_ID`, `BCMS_API_KEY_ID`, `BCMS_API_KEY_SECRET`.

Never commit these values to source control.

### Client initialisation

The official SDK is `@thebcms/client`. Common options:

- `injectSvg`: inline SVG icons directly into returned HTML.
- `useMemCache`: enable in‑memory caching of responses.
- `enableSocket`: toggle real‑time updates over websockets.

[Integration guides](https://thebcms.com/docs/integrations) typically use `new Client({ injectSvg: true })` with `BCMS_API_KEY` set, or `new Client({ apiKey: process.env...., injectSvg: true })` for a public key. The **four‑argument** constructor `(orgId, instanceId, { id, secret }, options)` remains valid for explicit credentials.

See `SKILL.md` for both patterns.

### General best‑practices

- Rotate API keys regularly.
- Scope keys to the minimum templates/functions/media required.
- Use HTTPS only and validate TLS certificates in production.

Refer to [thebcms.com/docs](https://thebcms.com/docs) for the latest details on authentication and client configuration.
