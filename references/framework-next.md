## Next.js Integration

This guide summarises how to integrate BCMS with a Next.js project.

### Standard client constructor

Use the standard BCMS client shape and adapt env variable names as needed:

```ts
import { Client } from '@thebcms/client';

export const bcms = new Client(
  process.env.BCMS_ORG_ID!,
  process.env.BCMS_INSTANCE_ID!,
  {
    id: process.env.BCMS_API_KEY_ID!,
    secret: process.env.BCMS_API_KEY_SECRET!,
  },
  {
    injectSvg: true,
  },
);
```

### Quick start (CLI)

The fastest way to get a working blog + BCMS is:

```bash
npx @thebcms/cli create next starter simple-blog
```

The CLI:

- Creates a BCMS project and populates it with sample content.
- Scaffolds a Next.js project.
- Generates `.env` and wires BCMS configuration.

### Manual setup

1. Create a Next.js app:

   ```bash
   npx create-next-app@latest
   ```

2. Install BCMS packages:

   ```bash
   npm i --save @thebcms/cli @thebcms/client @thebcms/components-react
   ```

3. Add scripts to `package.json`:

   ```json
   {
     "scripts": {
       "dev": "bcms --pull types --lng ts && next dev",
       "build": "bcms --pull types --lng ts && next build",
       "start": "bcms --pull types --lng ts && next start",
       "lint": "bcms --pull types --lng ts && next lint"
     }
   }
   ```

   `bcms --pull types --lng ts` runs the BCMS CLI and pulls generated types into `bcms/types/`.

4. Create `bcms.config.cjs`:

   ```js
   module.exports = {
     client: {
       orgId: 'YOUR_PROJECT_ORG_ID',
       instanceId: 'YOUR_PROJECT_INSTANCE_ID',
       apiKey: {
         id: 'API_KEY_ID',
         secret: 'API_KEY_SECRET',
       },
     },
   };
   ```

5. Use `BCMSContentManager` and `BCMSImage` from `@thebcms/components-react` to render entries and media.

