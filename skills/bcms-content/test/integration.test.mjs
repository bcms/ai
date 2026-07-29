/**
 * Optional integration test against a real BCMS instance.
 *
 * Skipped unless BOTH env vars are set (never required in normal CI):
 *   BCMS_TEST_API_KEY   — a three-part key for a NON-PRODUCTION test instance
 *   BCMS_TEST_TEMPLATE  — a template id or name the key can read
 *
 * Read-only by design: it only lists entries.
 *
 * Run: BCMS_TEST_API_KEY=… BCMS_TEST_TEMPLATE=… npm run test:integration
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(testDir, '..', 'cli', 'bcms.mjs');

const apiKey = process.env.BCMS_TEST_API_KEY;
const template = process.env.BCMS_TEST_TEMPLATE;
const enabled = Boolean(apiKey && template);

test('integration: list-entries --json against a real instance', { skip: !enabled && 'BCMS_TEST_API_KEY / BCMS_TEST_TEMPLATE not set' }, async () => {
    const result = await new Promise((resolve) => {
        const child = spawn(process.execPath, [cliPath, 'list-entries', template, '--json'], {
            env: { ...process.env, BCMS_API_KEY: apiKey },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => (stdout += chunk));
        child.stderr.on('data', (chunk) => (stderr += chunk));
        child.on('close', (code) => resolve({ code, stdout, stderr }));
    });

    assert.equal(result.code, 0, `stderr: ${result.stderr}`);
    const envelope = JSON.parse(result.stdout);
    assert.equal(envelope.ok, true);
    assert.ok(Array.isArray(envelope.data.entries));
});
