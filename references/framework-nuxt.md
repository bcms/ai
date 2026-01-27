## Nuxt Integration

This guide summarises how to integrate BCMS with a Nuxt project using the official Nuxt module.

### Quick start (CLI)

```bash
npx @thebcms/cli create nuxt starter simple-blog
```

The CLI sets up:

- A BCMS project with sample content.
- A Nuxt blog starter.
- Environment configuration for BCMS.

### Manual setup

1. Create a Nuxt project:

   ```bash
   npx nuxi@latest init my-project
   ```

2. Install BCMS Nuxt integration:

   ```bash
   npm i --save @thebcms/nuxt @thebcms/types
   ```

3. Configure `nuxt.config.ts`:

   ```ts
   export default defineNuxtConfig({
     bcms: {
       orgId: process.env.BCMS_ORG_ID,
       instanceId: process.env.BCMS_INSTANCE_ID,
       privateClientOptions: {
         key: {
           id: process.env.BCMS_API_KEY_ID!,
           secret: process.env.BCMS_API_KEY_SECRET!,
         },
       },
       publicClientOptions: {
         key: {
           id: process.env.NUXT_PUBLIC_BCMS_API_KEY_ID!,
           secret: process.env.NUXT_PUBLIC_BCMS_API_KEY_SECRET!,
         },
       },
     },
     modules: ['@thebcms/nuxt'],
   });
   ```

4. Use the injected composables:

   - `useBcmsPrivate()` – server‑side access (secure operations).
   - `useBcmsPublic()` – client‑side access with public API keys.

