## Gatsby Integration

This guide summarises how to integrate BCMS with a Gatsby project.

### Standard client constructor

Use the standard BCMS client shape:

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

```bash
npx @thebcms/cli create gatsby starter simple-blog
```

The CLI provisions a BCMS project, content, and a Gatsby blog starter.

### Manual setup

1. Create a Gatsby project:

   ```bash
   gatsby new
   ```

2. Install BCMS packages:

   ```bash
   npm i --save @thebcms/cli @thebcms/types @thebcms/utils @thebcms/client @thebcms/components-react
   ```

3. Add scripts to `package.json`:

   ```json
   {
     "scripts": {
       "develop": "bcms --pull types --lng ts && gatsby develop",
       "start": "bcms --pull types --lng ts && gatsby develop",
       "build": "bcms --pull types --lng ts && gatsby build",
       "serve": "bcms --pull types --lng ts && gatsby serve",
       "clean": "gatsby clean",
       "typecheck": "tsc --noEmit"
     }
   }
   ```

4. Configure `bcms.config.cjs` with `orgId`, `instanceId`, and API key.

5. In `gatsby-node.ts`, use the BCMS client to fetch entries and create pages.

