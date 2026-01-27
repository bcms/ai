/**
 * call-function.ts
 *
 * Demonstrates how to call a BCMS function via REST using fetch.
 * The function URL usually looks like:
 *   https://<org>.bcms.dev/api/<instance>/fn/<functionId>/call
 */

import 'cross-fetch/polyfill';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const baseUrl = requireEnv('BCMS_BASE_URL'); // e.g. https://org.bcms.dev
  const instanceId = requireEnv('BCMS_INSTANCE_ID');
  const functionId = requireEnv('BCMS_FUNCTION_ID');
  const apiKeyId = requireEnv('BCMS_API_KEY_ID');
  const apiKeySecret = requireEnv('BCMS_API_KEY_SECRET');

  const url = `${baseUrl}/api/${instanceId}/fn/${functionId}/call`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bcms-Api-Key-Id': apiKeyId,
      'X-Bcms-Api-Key-Secret': apiKeySecret,
    },
    body: JSON.stringify({ example: 'payload' }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Function call failed: ${res.status} ${res.statusText} - ${text}`);
  }

  const json = await res.json();
  console.log('Function response:', json);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error calling BCMS function:', error);
    process.exitCode = 1;
  });
}
