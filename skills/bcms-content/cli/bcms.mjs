#!/usr/bin/env node
/**
 * bcms-content — thin, agent-facing CLI for BCMS content operations.
 *
 * Wraps the official `@thebcms/client` SDK so entry meta is converted to the
 * raw props the backend expects (the SDK handles that; raw REST does not).
 *
 * Auth: set BCMS_API_KEY="keyId.secret.instanceId" — the SAME three-part key
 * used for the BCMS MCP. Optionally set BCMS_API_ORIGIN for self-hosted setups.
 *
 * Usage:
 *   node cli/bcms.mjs <command> [args] [flags]
 *   npx bcms-content <command> [args] [flags]   (after `npm install` in this folder)
 *
 * Machine mode:
 *   --json      JSON-only stdout: {"ok":true,"data":{…}} or
 *               {"ok":false,"error":{"code","message","details"}}. Diagnostics
 *               go to stderr. Never prompts.
 *   --yes       Skip confirmation for destructive commands (required for
 *               delete-entry in non-interactive or --json runs).
 *   --dry-run   Validate inputs and report the planned operation without
 *               calling any mutating API.
 *
 * Exit codes:
 *   0 success · 1 unknown error · 2 invalid argument / invalid JSON /
 *   unsupported operation · 3 authentication required or failed ·
 *   4 permission denied · 5 not found · 6 conflict · 7 rate limited ·
 *   8 network error · 9 API error · 10 confirmation required
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Command + error metadata (imported by repo release tooling — keep exported).
// ---------------------------------------------------------------------------

export const COMMANDS = {
    'create-entry': {
        summary: 'Create an entry in a template (by id or name).',
        usage: "create-entry <template> --data '<json>' | --data-file <path> [--lng en] [--status <id>] [--json] [--dry-run]",
        readOnly: false,
        destructive: false,
        retrySafe: false,
        retryNote: 'Retrying after an ambiguous failure can create duplicate entries — list entries first.',
    },
    'update-entry': {
        summary: 'Update an entry; returns the full parsed entry after the update.',
        usage: "update-entry <entryId> --template <t> --data '<json>' [--lng en] [--status <id>] [--json] [--dry-run]",
        readOnly: false,
        destructive: false,
        retrySafe: true,
        retryNote: 'Safe to retry: the same payload produces the same result.',
    },
    'delete-entry': {
        summary: 'Delete an entry (irreversible). Requires confirmation or --yes.',
        usage: 'delete-entry <entryId> --template <t> [--yes] [--json] [--dry-run]',
        readOnly: false,
        destructive: true,
        retrySafe: true,
        retryNote: 'Safe to retry: a repeated delete fails with NOT_FOUND, nothing else changes.',
    },
    'list-entries': {
        summary: 'List entry ids for a template (discovery before update/delete).',
        usage: 'list-entries <template> [--json]',
        readOnly: true,
        destructive: false,
        retrySafe: true,
        retryNote: 'Read-only; always safe to retry.',
    },
    'upload-media': {
        summary: 'Upload a file to the media library.',
        usage: 'upload-media <filePath> [--parent <dirId>] [--json] [--dry-run]',
        readOnly: false,
        destructive: false,
        retrySafe: false,
        retryNote: 'Retrying after an ambiguous failure can create duplicate media files.',
    },
};

export const ERROR_CODES = [
    'INVALID_ARGUMENT',
    'INVALID_JSON',
    'AUTHENTICATION_REQUIRED',
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'NOT_FOUND',
    'CONFLICT',
    'RATE_LIMITED',
    'NETWORK_ERROR',
    'API_ERROR',
    'UNSUPPORTED_OPERATION',
    'CONFIRMATION_REQUIRED',
];

export const EXIT_CODES = {
    OK: 0,
    UNKNOWN: 1,
    INVALID_ARGUMENT: 2,
    INVALID_JSON: 2,
    UNSUPPORTED_OPERATION: 2,
    AUTHENTICATION_REQUIRED: 3,
    AUTHENTICATION_FAILED: 3,
    PERMISSION_DENIED: 4,
    NOT_FOUND: 5,
    CONFLICT: 6,
    RATE_LIMITED: 7,
    NETWORK_ERROR: 8,
    API_ERROR: 9,
    CONFIRMATION_REQUIRED: 10,
};

// ---------------------------------------------------------------------------
// Errors and sanitisation
// ---------------------------------------------------------------------------

class CliError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.code = ERROR_CODES.includes(code) ? code : 'API_ERROR';
        this.details = details;
    }
}

const THREE_PART_KEY = /\b[a-f0-9]{24}\.[A-Za-z0-9+/=_-]{16,}\.[a-f0-9]{24}\b/g;

function sanitizeText(value) {
    let out = String(value);
    const apiKey = process.env.BCMS_API_KEY;
    if (apiKey && apiKey.length > 4) {
        out = out.split(apiKey).join('<redacted>');
    }
    out = out.replace(THREE_PART_KEY, '<redacted>');
    out = out.replace(/([?&](?:mcpKey|apiKey|key|token|secret)=)[^&\s"']+/gi, '$1<redacted>');
    out = out.replace(/((?:authorization|x-api-key)["':\s]+(?:Bearer\s+|Basic\s+)?)[A-Za-z0-9._~+/=-]{8,}/gi, '$1<redacted>');
    return out;
}

const SENSITIVE_KEYS = /^(authorization|apikey|api_key|mcpkey|token|secret|password|headers|config|request|cookie)$/i;

function sanitizeValue(value, depth = 0) {
    if (depth > 6 || value === null || value === undefined) {
        return value ?? null;
    }
    if (typeof value === 'string') {
        return sanitizeText(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
    }
    if (typeof value === 'object') {
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            if (SENSITIVE_KEYS.test(key)) {
                continue;
            }
            out[key] = sanitizeValue(entry, depth + 1);
        }
        return out;
    }
    return String(value);
}

/** Map SDK/HTTP/network failures to stable error codes. */
function classifyError(err) {
    if (err instanceof CliError) {
        return err;
    }
    const status = err?.response?.status ?? err?.status;
    if (typeof status === 'number') {
        const responseData = sanitizeValue(err.response?.data ?? err.data ?? null);
        const message = sanitizeText(
            (typeof responseData === 'object' && responseData?.message) || err.message || `HTTP ${status}`,
        );
        const details = { httpStatus: status, response: responseData };
        if (status === 401) {
            return new CliError('AUTHENTICATION_FAILED', `Authentication failed: ${message}`, details);
        }
        if (status === 403) {
            return new CliError('PERMISSION_DENIED', `Permission denied: ${message}`, details);
        }
        if (status === 404) {
            return new CliError('NOT_FOUND', `Not found: ${message}`, details);
        }
        if (status === 409) {
            return new CliError('CONFLICT', `Conflict: ${message}`, details);
        }
        if (status === 429) {
            return new CliError('RATE_LIMITED', `Rate limited: ${message}`, details);
        }
        return new CliError('API_ERROR', `API error (HTTP ${status}): ${message}`, details);
    }
    const networkCodes = ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'EPIPE', 'ERR_NETWORK'];
    if (err?.code && networkCodes.includes(err.code)) {
        return new CliError('NETWORK_ERROR', sanitizeText(`Network error (${err.code}): ${err.message || 'request failed'}`), {
            cause: err.code,
        });
    }
    if (err?.request && !err?.response) {
        return new CliError('NETWORK_ERROR', sanitizeText(`Network error: ${err.message || 'no response received'}`), {});
    }
    return new CliError('API_ERROR', sanitizeText(err?.message || String(err)), {});
}

// ---------------------------------------------------------------------------
// Argument parsing and output
// ---------------------------------------------------------------------------

const BOOLEAN_FLAGS = new Set(['json', 'yes', 'dry-run', 'help']);
const VALUE_FLAGS = new Set(['data', 'data-file', 'lng', 'status', 'template', 'parent']);

function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token === '-h') {
            args.help = true;
            continue;
        }
        if (!token.startsWith('--')) {
            args._.push(token);
            continue;
        }
        const key = token.slice(2);
        if (BOOLEAN_FLAGS.has(key)) {
            args[key] = true;
            continue;
        }
        if (!VALUE_FLAGS.has(key)) {
            throw new CliError('INVALID_ARGUMENT', `Unknown flag: --${key}. Run \`help\` for usage.`, { flag: key });
        }
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) {
            throw new CliError('INVALID_ARGUMENT', `Flag --${key} requires a value.`, { flag: key });
        }
        args[key] = next;
        i++;
    }
    return args;
}

function emitSuccess(args, data, humanLines) {
    if (args.json) {
        process.stdout.write(`${JSON.stringify({ ok: true, data })}\n`);
        return;
    }
    for (const line of humanLines) {
        console.log(line);
    }
}

function emitError(args, cliError) {
    const diagnostic = `bcms-content: [${cliError.code}] ${cliError.message}`;
    if (args?.json) {
        process.stdout.write(
            `${JSON.stringify({ ok: false, error: { code: cliError.code, message: cliError.message, details: cliError.details ?? {} } })}\n`,
        );
        process.stderr.write(`${diagnostic}\n`);
    } else {
        process.stderr.write(`${diagnostic}\n`);
    }
    process.exit(EXIT_CODES[cliError.code] ?? EXIT_CODES.UNKNOWN);
}

function isInteractive() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function confirm(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    const answer = await new Promise((resolve) => rl.question(`${question} [y/N] `, resolve));
    rl.close();
    return /^y(es)?$/i.test(answer.trim());
}

/**
 * Destructive commands require explicit consent:
 * - `--yes` always works (required in --json and non-TTY runs);
 * - interactive human runs get a stderr prompt.
 */
async function ensureConfirmed(args, description) {
    if (args.yes || args['dry-run']) {
        return;
    }
    if (args.json || !isInteractive()) {
        throw new CliError('CONFIRMATION_REQUIRED', `${description} is destructive. Re-run with --yes to confirm (or --dry-run to preview).`, {
            requiredFlag: '--yes',
        });
    }
    if (!(await confirm(`${description} — continue?`))) {
        throw new CliError('CONFIRMATION_REQUIRED', 'Aborted by user.', {});
    }
}

// ---------------------------------------------------------------------------
// Client + input helpers
// ---------------------------------------------------------------------------

async function getClient() {
    const apiKey = process.env.BCMS_API_KEY;
    if (!apiKey) {
        throw new CliError(
            'AUTHENTICATION_REQUIRED',
            'BCMS_API_KEY is required (format: keyId.secret.instanceId — the same key used for the BCMS MCP).',
            { env: 'BCMS_API_KEY' },
        );
    }
    // BCMS_CLIENT_MODULE is an internal test hook: a module exporting a
    // compatible `Client` class used instead of @thebcms/client.
    const moduleId = process.env.BCMS_CLIENT_MODULE || '@thebcms/client';
    let Client;
    try {
        ({ Client } = await import(moduleId));
    } catch {
        throw new CliError(
            'UNSUPPORTED_OPERATION',
            'Cannot find "@thebcms/client". Run `npm install` inside the bcms-content skill folder first.',
            { module: '@thebcms/client' },
        );
    }
    const options = { apiKey, useMemCache: true, injectSvg: false };
    if (process.env.BCMS_API_ORIGIN) {
        options.cmsOrigin = process.env.BCMS_API_ORIGIN;
    }
    return new Client(options);
}

function readData(args) {
    let raw;
    let source;
    if (args['data-file']) {
        const filePath = path.resolve(String(args['data-file']));
        if (!fs.existsSync(filePath)) {
            throw new CliError('INVALID_ARGUMENT', `--data-file not found: ${filePath}`, { path: filePath });
        }
        raw = fs.readFileSync(filePath, 'utf8');
        source = '--data-file';
    } else if (typeof args.data === 'string') {
        raw = args.data;
        source = '--data';
    }
    if (!raw) {
        throw new CliError('INVALID_ARGUMENT', "missing entry data — pass --data '<json>' or --data-file <path>.", {});
    }
    try {
        return JSON.parse(raw);
    } catch (err) {
        throw new CliError('INVALID_JSON', `${source} is not valid JSON: ${err.message}`, { source });
    }
}

function toContentNodes(content) {
    if (!content) {
        return [];
    }
    if (Array.isArray(content)) {
        return content;
    }
    if (typeof content === 'string') {
        return content.split(/\n{2,}/).map((block) => {
            const text = block.trim();
            return {
                type: 'paragraph',
                content: text ? [{ type: 'text', text: text.replace(/\n/g, ' ') }] : [],
            };
        });
    }
    throw new CliError('INVALID_ARGUMENT', '`content` must be a string or an array of content nodes.', {});
}

const MIME_BY_EXT = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.zip': 'application/zip',
};

function mimeFromName(name) {
    return MIME_BY_EXT[path.extname(name).toLowerCase()] || 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function createEntry(args) {
    const template = args._[0] || (typeof args.template === 'string' ? args.template : undefined);
    if (!template) {
        throw new CliError('INVALID_ARGUMENT', 'create-entry requires a template: `create-entry <templateIdOrName>`.', {});
    }
    const lng = typeof args.lng === 'string' ? args.lng : 'en';
    const status = typeof args.status === 'string' ? args.status : undefined;
    const input = readData(args);
    const nodes = toContentNodes(input.content);

    if (args['dry-run']) {
        emitSuccess(
            args,
            { dryRun: true, action: 'create-entry', template, lng, status: status ?? null, meta: input.meta || {}, contentNodes: nodes.length },
            [`Dry run: would create an entry in template "${template}" (lng ${lng}, ${nodes.length} content node(s)). No API call made.`],
        );
        return;
    }

    const client = await getClient();
    const entry = await client.entry.create(template, {
        statuses: status ? [{ lng, id: status }] : [],
        meta: [{ lng, data: input.meta || {} }],
        content: [{ lng, nodes }],
    });
    const fullEntry = await client.entry.getById(entry._id, template);
    emitSuccess(args, fullEntry, [`Created entry ${entry._id} (template "${template}")`, JSON.stringify(fullEntry, null, 2)]);
}

async function updateEntry(args) {
    const entryId = args._[0];
    const template = typeof args.template === 'string' ? args.template : undefined;
    if (!entryId) {
        throw new CliError('INVALID_ARGUMENT', 'update-entry requires an entry id: `update-entry <entryId> --template <t>`.', {});
    }
    if (!template) {
        throw new CliError('INVALID_ARGUMENT', 'update-entry requires --template <idOrName>.', {});
    }
    const lng = typeof args.lng === 'string' ? args.lng : 'en';
    const status = typeof args.status === 'string' ? args.status : undefined;
    const input = readData(args);

    if (args['dry-run']) {
        emitSuccess(
            args,
            {
                dryRun: true,
                action: 'update-entry',
                entryId,
                template,
                lng,
                status: status ?? null,
                metaKeys: Object.keys(input.meta || {}),
                contentReplaced: input.content !== undefined,
            },
            [`Dry run: would update entry ${entryId} (template "${template}", lng ${lng}). No API call made.`],
        );
        return;
    }

    const client = await getClient();
    let nodes;
    if (input.content !== undefined) {
        nodes = toContentNodes(input.content);
    } else {
        const existing = await client.entry.getByIdRaw(entryId, template);
        const current = existing.content.find((e) => e.lng === lng);
        nodes = current ? current.nodes : [];
    }
    const existingParsed = await client.entry.getById(entryId, template);
    const existingMeta = existingParsed.meta[lng] || {};
    const mergedMeta = { ...existingMeta, ...(input.meta || {}) };
    const entry = await client.entry.update(template, entryId, {
        lng,
        status,
        meta: mergedMeta,
        content: nodes,
    });
    const fullEntry = await client.entry.getById(entryId, template);
    emitSuccess(args, fullEntry, [`Updated entry ${entry._id} (template "${template}")`, JSON.stringify(fullEntry, null, 2)]);
}

async function deleteEntry(args) {
    const entryId = args._[0];
    const template = typeof args.template === 'string' ? args.template : undefined;
    if (!entryId) {
        throw new CliError('INVALID_ARGUMENT', 'delete-entry requires an entry id: `delete-entry <entryId> --template <t>`.', {});
    }
    if (!template) {
        throw new CliError('INVALID_ARGUMENT', 'delete-entry requires --template <idOrName>.', {});
    }

    if (args['dry-run']) {
        emitSuccess(
            args,
            { dryRun: true, action: 'delete-entry', affected: [{ type: 'entry', entryId, template }] },
            [`Dry run: would delete entry ${entryId} (template "${template}"). No API call made.`],
        );
        return;
    }

    await ensureConfirmed(args, `Delete entry ${entryId} (template "${template}")`);

    const client = await getClient();
    await client.entry.deleteById(entryId, template);
    emitSuccess(args, { deleted: true, entryId, template }, [`Deleted entry ${entryId} (template "${template}")`]);
}

async function listEntries(args) {
    const template = args._[0] || (typeof args.template === 'string' ? args.template : undefined);
    if (!template) {
        throw new CliError('INVALID_ARGUMENT', 'list-entries requires a template: `list-entries <templateIdOrName>`.', {});
    }
    const client = await getClient();
    const entries = await client.entry.getAllLite(template);
    const items = entries.map((e) => ({ _id: e._id, templateId: e.templateId }));
    emitSuccess(args, { template, entries: items }, [JSON.stringify(items, null, 2)]);
}

async function uploadMedia(args) {
    const filePath = args._[0];
    if (!filePath) {
        throw new CliError('INVALID_ARGUMENT', 'upload-media requires a file path: `upload-media <filePath>`.', {});
    }
    const abs = path.resolve(filePath);
    if (!fs.existsSync(abs)) {
        throw new CliError('INVALID_ARGUMENT', `file not found: ${abs}`, { path: abs });
    }
    const name = path.basename(abs);
    const parentId = typeof args.parent === 'string' ? args.parent : undefined;

    if (args['dry-run']) {
        const size = fs.statSync(abs).size;
        emitSuccess(
            args,
            { dryRun: true, action: 'upload-media', file: abs, name, mimeType: mimeFromName(name), bytes: size, parentId: parentId ?? null },
            [`Dry run: would upload ${name} (${size} bytes)${parentId ? ` into directory ${parentId}` : ''}. No API call made.`],
        );
        return;
    }

    const buffer = await fs.promises.readFile(abs);
    const client = await getClient();
    const uploadToken = await client.media.requestUploadToken();
    const file = new File([buffer], name, { type: mimeFromName(name) });
    const media = await client.media.createFile({ uploadToken, file, name, parentId });
    const payload = { _id: media._id, name: media.name, type: media.type };
    emitSuccess(args, payload, [`Uploaded media ${media._id} (${media.name})`, JSON.stringify(payload, null, 2)]);
}

// ---------------------------------------------------------------------------
// Help + entry point
// ---------------------------------------------------------------------------

function helpText() {
    const commandLines = Object.entries(COMMANDS)
        .map(([, meta]) => `  ${meta.usage}`)
        .join('\n');
    return `bcms-content — BCMS content operations CLI

Auth:
  export BCMS_API_KEY="keyId.secret.instanceId"   (same key as the BCMS MCP)
  export BCMS_API_ORIGIN="https://app.thebcms.com" (optional; for self-hosted)

Commands:
${commandLines}
  help

Global flags:
  --json     machine mode: JSON-only stdout ({"ok":true,"data":…} or
             {"ok":false,"error":{"code","message","details"}}); diagnostics on stderr
  --yes      skip confirmation for destructive commands (delete-entry)
  --dry-run  validate inputs and report the planned operation without mutating

--data JSON (single language, controlled by --lng):
  { "meta": { "<propName>": <value> }, "content"?: "<string or node[]>" }

Exit codes:
  0 success · 1 unknown · 2 invalid argument/JSON/unsupported ·
  3 authentication · 4 permission denied · 5 not found · 6 conflict ·
  7 rate limited · 8 network · 9 API error · 10 confirmation required

Examples:
  node cli/bcms.mjs create-entry blog --data '{"meta":{"title":"Hello","slug":"hello"},"content":"First paragraph."}'
  node cli/bcms.mjs update-entry 663f... --template blog --data '{"meta":{"title":"Updated title"}}' --json
  node cli/bcms.mjs list-entries blog --json
  node cli/bcms.mjs delete-entry 663f... --template blog --yes
  node cli/bcms.mjs upload-media ./hero.png`;
}

export async function main(argv = process.argv.slice(2)) {
    const command = argv[0];
    let args;
    try {
        args = parseArgs(argv.slice(1));
    } catch (err) {
        // Flag parsing failed before we know the output mode; honour --json if present.
        emitError({ json: argv.includes('--json') }, classifyError(err));
        return;
    }

    // Help is always human-readable, even with --json.
    if (command === 'help' || command === '--help' || command === '-h' || command === undefined || args.help) {
        console.log(helpText());
        return;
    }

    try {
        switch (command) {
            case 'create-entry':
                return await createEntry(args);
            case 'update-entry':
                return await updateEntry(args);
            case 'delete-entry':
                return await deleteEntry(args);
            case 'list-entries':
                return await listEntries(args);
            case 'upload-media':
                return await uploadMedia(args);
            default:
                throw new CliError('INVALID_ARGUMENT', `Unknown command: ${command}. Run \`help\` for usage.`, { command });
        }
    } catch (err) {
        emitError(args, classifyError(err));
    }
}

function isMainModule() {
    if (!process.argv[1]) {
        return false;
    }
    try {
        return fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
    } catch {
        return false;
    }
}

if (isMainModule()) {
    main().catch((err) => {
        emitError({ json: process.argv.includes('--json') }, classifyError(err));
    });
}
