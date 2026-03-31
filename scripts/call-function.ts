/**
 * call-function.ts
 *
 * Demonstrates how to call a BCMS function via REST using fetch.
 * The function URL usually looks like:
 *   https://<org>.bcms.dev/api/<instance>/fn/<functionId>/call
 *
 * Env: BCMS_API_KEY (three-part keyId.secret.instanceId — instance is the third segment),
 *      BCMS_BASE_URL (e.g. https://org.bcms.dev), BCMS_FUNCTION_ID
 */

import 'cross-fetch/polyfill';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Parse BCMS three-part API key into id, secret, and instanceId for REST headers and URL path. */
function parseBcmsApiKey(combined: string): { id: string; secret: string; instanceId: string } {
  const parts = combined.split('.');
  if (parts.length !== 3) {
    throw new Error(
      'BCMS_API_KEY must be exactly three dot-separated segments: keyId.secret.instanceId',
    );
  }
  return { id: parts[0], secret: parts[1], instanceId: parts[2] };
}

async function main() {
  const baseUrl = requireEnv('BCMS_BASE_URL').replace(/\/$/, '');
  const functionId = requireEnv('BCMS_FUNCTION_ID');
  const { id: apiKeyId, secret: apiKeySecret, instanceId } = parseBcmsApiKey(
    requireEnv('BCMS_API_KEY'),
  );

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
