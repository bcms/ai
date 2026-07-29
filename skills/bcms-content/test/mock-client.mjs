/**
 * Mock @thebcms/client used by the CLI tests via the BCMS_CLIENT_MODULE hook.
 * Behaviour is controlled with the BCMS_MOCK env var:
 *
 *   ok (default) — happy-path responses
 *   http-401 / http-403 / http-404 / http-409 / http-429 / http-500 — axios-like
 *     HTTP errors from every API call
 *   network — connection-refused style failure
 *   leak — HTTP 401 whose message embeds the API key (redaction test)
 *
 * Template "missing-template" and entry id "missing-entry" always 404,
 * regardless of mode.
 */

function httpError(status, message) {
    const err = new Error(message);
    err.response = {
        status,
        data: { message },
        headers: { authorization: 'Bearer real-token-should-never-print' },
    };
    return err;
}

function networkError() {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:443');
    err.code = 'ECONNREFUSED';
    err.request = {};
    return err;
}

function maybeFail(apiKey) {
    const mode = process.env.BCMS_MOCK || 'ok';
    switch (mode) {
        case 'ok':
            return;
        case 'http-401':
            throw httpError(401, 'Invalid API key.');
        case 'http-403':
            throw httpError(403, 'Key lacks permission for this template.');
        case 'http-404':
            throw httpError(404, 'Resource not found.');
        case 'http-409':
            throw httpError(409, 'Conflicting entry state.');
        case 'http-429':
            throw httpError(429, 'Too many requests.');
        case 'http-500':
            throw httpError(500, 'Internal server error.');
        case 'network':
            throw networkError();
        case 'leak':
            throw httpError(401, `Invalid key "${apiKey}" for https://app.thebcms.com/api?apiKey=${apiKey}`);
        default:
            throw new Error(`Unknown BCMS_MOCK mode: ${mode}`);
    }
}

function guardIds(template, entryId) {
    if (template === 'missing-template') {
        throw httpError(404, `Template "${template}" not found.`);
    }
    if (entryId === 'missing-entry') {
        throw httpError(404, `Entry "${entryId}" not found.`);
    }
}

const FULL_ENTRY = {
    _id: 'entry-1',
    templateId: 'template-1',
    statuses: [],
    meta: { en: { title: 'Hello', slug: 'hello' } },
    content: { en: [] },
};

export class Client {
    constructor(options) {
        this.options = options;
        const apiKey = options.apiKey;

        this.entry = {
            create: async (template) => {
                maybeFail(apiKey);
                guardIds(template);
                return { _id: 'entry-1' };
            },
            getById: async (entryId, template) => {
                maybeFail(apiKey);
                guardIds(template, entryId);
                return { ...FULL_ENTRY, _id: entryId };
            },
            getByIdRaw: async (entryId, template) => {
                maybeFail(apiKey);
                guardIds(template, entryId);
                return {
                    _id: entryId,
                    content: [{ lng: 'en', nodes: [{ type: 'paragraph', content: [{ type: 'text', text: 'existing' }] }] }],
                };
            },
            update: async (template, entryId) => {
                maybeFail(apiKey);
                guardIds(template, entryId);
                return { _id: entryId };
            },
            deleteById: async (entryId, template) => {
                maybeFail(apiKey);
                guardIds(template, entryId);
            },
            getAllLite: async (template) => {
                maybeFail(apiKey);
                guardIds(template);
                return [
                    { _id: 'entry-1', templateId: 'template-1' },
                    { _id: 'entry-2', templateId: 'template-1' },
                ];
            },
        };

        this.media = {
            requestUploadToken: async () => {
                maybeFail(apiKey);
                return 'mock-upload-token';
            },
            createFile: async ({ name, parentId }) => {
                maybeFail(apiKey);
                return { _id: 'media-1', name, type: 'IMG', parentId: parentId ?? null };
            },
        };
    }
}
