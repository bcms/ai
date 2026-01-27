/**
 * init-client.ts
 *
 * Demonstrates how to instantiate the BCMS client using environment variables.
 * This script is intended as reference for the bcms Agent Skill and can be
 * adapted into real applications or scripts.
 */

import { Client } from '@thebcms/client';


export function createBcmsClient() {
  const orgId = process.env.BCMS_ORG_ID;
  const instanceId = process.env.BCMS_INSTANCE_ID;
  const apiKeyId = process.env.BCMS_API_KEY_ID;
  const apiKeySecret = process.env.BCMS_API_KEY_SECRET;

  const client = new Client(
    orgId,
    instanceId,
    {
      id: apiKeyId,
      secret: apiKeySecret,
    },
    {
      injectSvg: true,
      useMemCache: true,
      enableSocket: false,
    },
  );

  return client;
}

// If executed directly, just verify the client can be constructed.
if (require.main === module) {
  (async () => {
    try {
      const bcms = createBcmsClient();
      // Optionally perform a lightweight call, e.g. list templates.
      const templates = await bcms.template.getAll().catch(() => []);
      console.log(`BCMS client initialised. Templates fetched: ${templates.length}`);
    } catch (error) {
      console.error('Failed to initialise BCMS client:', error);
      process.exitCode = 1;
    }
  })();
}
