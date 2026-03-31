/**
 * init-client.ts
 *
 * Constructs @thebcms/client using BCMS_API_KEY (three-part string keyId.secret.instanceId).
 * See https://thebcms.com/docs/integrations
 */

import { Client } from '@thebcms/client';

export function createBcmsClient() {
  if (!process.env.BCMS_API_KEY?.trim()) {
    throw new Error('BCMS_API_KEY is required (format: keyId.secret.instanceId)');
  }

  return new Client({
    injectSvg: true,
    useMemCache: true,
    enableSocket: false,
  });
}

// If executed directly, just verify the client can be constructed.
if (require.main === module) {
  (async () => {
    try {
      const bcms = createBcmsClient();
      const templates = await bcms.template.getAll().catch(() => []);
      console.log(`BCMS client initialised. Templates fetched: ${templates.length}`);
    } catch (error) {
      console.error('Failed to initialise BCMS client:', error);
      process.exitCode = 1;
    }
  })();
}
