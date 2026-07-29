/**
 * bcms-content CLI tests. Every test spawns the CLI as a subprocess with the
 * mocked @thebcms/client (BCMS_CLIENT_MODULE hook), so stdout/stderr
 * separation, exit codes, and TTY behaviour are exercised for real.
 *
 * Run: node --test skills/bcms-content/test/   (or `npm test` at the repo root)
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(testDir, '..', 'cli', 'bcms.mjs');
const mockClientPath = path.join(testDir, 'mock-client.mjs');

// Shaped like a real three-part key so redaction is exercised, but contains
// "EXAMPLE" so the repo secret scanner treats it as a placeholder.
const FAKE_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2.superSecretEXAMPLE1234.f2e1d0c9b8a7f6e5d4c3b2a1';

/**
 * @param {string[]} args
 * @param {{ env?: Record<string,string>, apiKey?: string | null }} [options]
 */
function runCli(args, options = {}) {
    return new Promise((resolve) => {
        const env = {
            ...process.env,
            BCMS_CLIENT_MODULE: mockClientPath,
            BCMS_MOCK: 'ok',
            ...options.env,
        };
        if (options.apiKey === null) {
            delete env.BCMS_API_KEY;
        } else {
            env.BCMS_API_KEY = options.apiKey ?? FAKE_KEY;
        }
        const child = spawn(process.execPath, [cliPath, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => (stdout += chunk));
        child.stderr.on('data', (chunk) => (stderr += chunk));
        child.on('close', (code) => resolve({ code, stdout, stderr }));
    });
}

function parseEnvelope(stdout) {
    return JSON.parse(stdout);
}

// --- help -------------------------------------------------------------------

test('help output lists commands and exit codes, exits 0', async () => {
    const result = await runCli(['help']);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /create-entry/);
    assert.match(result.stdout, /delete-entry/);
    assert.match(result.stdout, /--dry-run/);
    assert.match(result.stdout, /Exit codes/);
});

test('no command prints help, exits 0', async () => {
    const result = await runCli([]);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /bcms-content — BCMS content operations CLI/);
});

// --- list-entries -----------------------------------------------------------

test('list-entries human mode prints a JSON array to stdout', async () => {
    const result = await runCli(['list-entries', 'blog']);
    assert.equal(result.code, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0]._id, 'entry-1');
    assert.equal(result.stderr, '');
});

test('list-entries --json returns a success envelope', async () => {
    const result = await runCli(['list-entries', 'blog', '--json']);
    assert.equal(result.code, 0);
    const envelope = parseEnvelope(result.stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.template, 'blog');
    assert.equal(envelope.data.entries.length, 2);
});

// --- create-entry -----------------------------------------------------------

test('create-entry --json returns the full entry in the envelope', async () => {
    const result = await runCli(['create-entry', 'blog', '--data', '{"meta":{"title":"Hi"},"content":"Body."}', '--json']);
    assert.equal(result.code, 0);
    const envelope = parseEnvelope(result.stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data._id, 'entry-1');
    assert.equal(envelope.data.meta.en.title, 'Hello');
});

test('create-entry human mode prints a status line and JSON payload', async () => {
    const result = await runCli(['create-entry', 'blog', '--data', '{"meta":{"title":"Hi"}}']);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /^Created entry entry-1/);
    assert.match(result.stdout, /"meta"/);
});

test('create-entry --dry-run makes no API call and reports the plan', async () => {
    // BCMS_MOCK=http-500 would fail any API call; dry-run must not reach it.
    const result = await runCli(['create-entry', 'blog', '--data', '{"meta":{"title":"Hi"},"content":"A.\\n\\nB."}', '--dry-run', '--json'], {
        env: { BCMS_MOCK: 'http-500' },
    });
    assert.equal(result.code, 0);
    const envelope = parseEnvelope(result.stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.dryRun, true);
    assert.equal(envelope.data.action, 'create-entry');
    assert.equal(envelope.data.contentNodes, 2);
});

// --- update-entry -----------------------------------------------------------

test('update-entry --json returns the updated entry', async () => {
    const result = await runCli(['update-entry', 'entry-1', '--template', 'blog', '--data', '{"meta":{"title":"New"}}', '--json']);
    assert.equal(result.code, 0);
    const envelope = parseEnvelope(result.stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data._id, 'entry-1');
});

test('update-entry without --template fails with INVALID_ARGUMENT', async () => {
    const result = await runCli(['update-entry', 'entry-1', '--data', '{"meta":{}}', '--json']);
    assert.equal(result.code, 2);
    const envelope = parseEnvelope(result.stdout);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.error.code, 'INVALID_ARGUMENT');
});

// --- delete-entry (confirmation model) ---------------------------------------

test('delete-entry without --yes in non-TTY mode fails with CONFIRMATION_REQUIRED', async () => {
    const result = await runCli(['delete-entry', 'entry-1', '--template', 'blog', '--json']);
    assert.equal(result.code, 10);
    const envelope = parseEnvelope(result.stdout);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.error.code, 'CONFIRMATION_REQUIRED');
});

test('delete-entry --yes deletes and returns a machine-readable result', async () => {
    const result = await runCli(['delete-entry', 'entry-1', '--template', 'blog', '--yes', '--json']);
    assert.equal(result.code, 0);
    const envelope = parseEnvelope(result.stdout);
    assert.equal(envelope.ok, true);
    assert.deepEqual(envelope.data, { deleted: true, entryId: 'entry-1', template: 'blog' });
});

test('delete-entry --yes human mode prints only the status line', async () => {
    const result = await runCli(['delete-entry', 'entry-1', '--template', 'blog', '--yes']);
    assert.equal(result.code, 0);
    assert.equal(result.stdout.trim(), 'Deleted entry entry-1 (template "blog")');
});

test('delete-entry --dry-run lists affected resources without deleting', async () => {
    const result = await runCli(['delete-entry', 'entry-1', '--template', 'blog', '--dry-run', '--json'], {
        env: { BCMS_MOCK: 'http-500' },
    });
    assert.equal(result.code, 0);
    const envelope = parseEnvelope(result.stdout);
    assert.equal(envelope.data.dryRun, true);
    assert.deepEqual(envelope.data.affected, [{ type: 'entry', entryId: 'entry-1', template: 'blog' }]);
});

// --- upload-media -------------------------------------------------------------

test('upload-media --json uploads a file and returns media info', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bcms-cli-test-'));
    const filePath = path.join(dir, 'hero.png');
    writeFileSync(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const result = await runCli(['upload-media', filePath, '--parent', 'dir-1', '--json']);
    assert.equal(result.code, 0);
    const envelope = parseEnvelope(result.stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data._id, 'media-1');
    assert.equal(envelope.data.name, 'hero.png');
});

test('upload-media with a missing file fails with INVALID_ARGUMENT', async () => {
    const result = await runCli(['upload-media', '/nonexistent/file.png', '--json']);
    assert.equal(result.code, 2);
    const envelope = parseEnvelope(result.stdout);
    assert.equal(envelope.error.code, 'INVALID_ARGUMENT');
});

// --- argument and JSON validation ----------------------------------------------

test('unknown command fails with INVALID_ARGUMENT and exit 2', async () => {
    const result = await runCli(['frobnicate', '--json']);
    assert.equal(result.code, 2);
    const envelope = parseEnvelope(result.stdout);
    assert.equal(envelope.error.code, 'INVALID_ARGUMENT');
});

test('unknown flag fails with INVALID_ARGUMENT', async () => {
    const result = await runCli(['list-entries', 'blog', '--bogus-flag', 'x', '--json']);
    assert.equal(result.code, 2);
    const envelope = parseEnvelope(result.stdout);
    assert.equal(envelope.error.code, 'INVALID_ARGUMENT');
});

test('missing arguments fail with INVALID_ARGUMENT', async () => {
    const result = await runCli(['create-entry', '--json']);
    assert.equal(result.code, 2);
    const envelope = parseEnvelope(result.stdout);
    assert.equal(envelope.error.code, 'INVALID_ARGUMENT');
});

test('malformed JSON fails with INVALID_JSON', async () => {
    const result = await runCli(['create-entry', 'blog', '--data', '{not json', '--json']);
    assert.equal(result.code, 2);
    const envelope = parseEnvelope(result.stdout);
    assert.equal(envelope.error.code, 'INVALID_JSON');
});

test('--data-file reads entry data from disk', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'bcms-cli-test-'));
    const dataFile = path.join(dir, 'post.json');
    writeFileSync(dataFile, JSON.stringify({ meta: { title: 'From file' } }));
    const result = await runCli(['create-entry', 'blog', '--data-file', dataFile, '--json']);
    assert.equal(result.code, 0);
    assert.equal(parseEnvelope(result.stdout).ok, true);
});

test('--data-file with a missing path fails with INVALID_ARGUMENT', async () => {
    const result = await runCli(['create-entry', 'blog', '--data-file', '/nope.json', '--json']);
    assert.equal(result.code, 2);
    assert.equal(parseEnvelope(result.stdout).error.code, 'INVALID_ARGUMENT');
});

// --- authentication and API failures ---------------------------------------------

test('missing API key fails with AUTHENTICATION_REQUIRED and exit 3', async () => {
    const result = await runCli(['list-entries', 'blog', '--json'], { apiKey: null });
    assert.equal(result.code, 3);
    assert.equal(parseEnvelope(result.stdout).error.code, 'AUTHENTICATION_REQUIRED');
});

test('invalid API key (HTTP 401) fails with AUTHENTICATION_FAILED and exit 3', async () => {
    const result = await runCli(['list-entries', 'blog', '--json'], { env: { BCMS_MOCK: 'http-401' } });
    assert.equal(result.code, 3);
    assert.equal(parseEnvelope(result.stdout).error.code, 'AUTHENTICATION_FAILED');
});

test('insufficient permissions (HTTP 403) fails with PERMISSION_DENIED and exit 4', async () => {
    const result = await runCli(['list-entries', 'blog', '--json'], { env: { BCMS_MOCK: 'http-403' } });
    assert.equal(result.code, 4);
    assert.equal(parseEnvelope(result.stdout).error.code, 'PERMISSION_DENIED');
});

test('missing entry (HTTP 404) fails with NOT_FOUND and exit 5', async () => {
    const result = await runCli(['delete-entry', 'missing-entry', '--template', 'blog', '--yes', '--json']);
    assert.equal(result.code, 5);
    assert.equal(parseEnvelope(result.stdout).error.code, 'NOT_FOUND');
});

test('missing template (HTTP 404) fails with NOT_FOUND', async () => {
    const result = await runCli(['list-entries', 'missing-template', '--json']);
    assert.equal(result.code, 5);
    assert.equal(parseEnvelope(result.stdout).error.code, 'NOT_FOUND');
});

test('conflict (HTTP 409) maps to CONFLICT and exit 6', async () => {
    const result = await runCli(['list-entries', 'blog', '--json'], { env: { BCMS_MOCK: 'http-409' } });
    assert.equal(result.code, 6);
    assert.equal(parseEnvelope(result.stdout).error.code, 'CONFLICT');
});

test('rate limit (HTTP 429) maps to RATE_LIMITED and exit 7', async () => {
    const result = await runCli(['list-entries', 'blog', '--json'], { env: { BCMS_MOCK: 'http-429' } });
    assert.equal(result.code, 7);
    assert.equal(parseEnvelope(result.stdout).error.code, 'RATE_LIMITED');
});

test('network failure maps to NETWORK_ERROR and exit 8', async () => {
    const result = await runCli(['list-entries', 'blog', '--json'], { env: { BCMS_MOCK: 'network' } });
    assert.equal(result.code, 8);
    assert.equal(parseEnvelope(result.stdout).error.code, 'NETWORK_ERROR');
});

test('server error (HTTP 500) maps to API_ERROR and exit 9', async () => {
    const result = await runCli(['list-entries', 'blog', '--json'], { env: { BCMS_MOCK: 'http-500' } });
    assert.equal(result.code, 9);
    assert.equal(parseEnvelope(result.stdout).error.code, 'API_ERROR');
});

// --- stdout/stderr separation and sanitisation -------------------------------------

test('json mode: stdout is a single parseable JSON envelope, diagnostics on stderr', async () => {
    const result = await runCli(['list-entries', 'blog', '--json'], { env: { BCMS_MOCK: 'http-500' } });
    const lines = result.stdout.trim().split('\n');
    assert.equal(lines.length, 1);
    assert.doesNotThrow(() => JSON.parse(lines[0]));
    assert.match(result.stderr, /bcms-content: \[API_ERROR\]/);
});

test('human mode errors go to stderr only', async () => {
    const result = await runCli(['list-entries', 'blog'], { env: { BCMS_MOCK: 'http-500' } });
    assert.equal(result.code, 9);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /bcms-content: \[API_ERROR\]/);
});

test('API errors never leak the API key or secret query params', async () => {
    const result = await runCli(['list-entries', 'blog', '--json'], { env: { BCMS_MOCK: 'leak' } });
    assert.equal(result.code, 3);
    assert.ok(!result.stdout.includes(FAKE_KEY), 'stdout must not contain the API key');
    assert.ok(!result.stderr.includes(FAKE_KEY), 'stderr must not contain the API key');
    assert.ok(!result.stdout.includes('real-token-should-never-print'), 'response headers must not be echoed');
    assert.match(result.stdout, /<redacted>/);
});
