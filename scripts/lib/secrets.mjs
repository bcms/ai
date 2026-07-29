/**
 * Secret detection for skill files, plugin packages, and release artifacts.
 * Placeholders used in docs (YOUR_MCP_KEY_HERE, keyId.secret.instanceId, <...>)
 * must never match.
 */

const PATTERNS = [
  {
    name: "BCMS three-part API key",
    // keyId and instanceId are 24-char hex object ids; the placeholder
    // "keyId.secret.instanceId" does not match.
    regex: /\b[a-f0-9]{24}\.[A-Za-z0-9+/=_-]{16,}\.[a-f0-9]{24}\b/g,
  },
  {
    name: "mcpKey query parameter with a real-looking value",
    regex: /[?&]mcpKey=(?!YOUR_|<|\$|%|keyId\.)[A-Za-z0-9.+/=_-]{24,}/g,
  },
  {
    name: "Authorization header with a real-looking token",
    regex: /Authorization:\s*(?:Bearer|Basic)\s+(?!YOUR_|<|\$|\{|xxx|TOKEN)[A-Za-z0-9._~+/=-]{20,}/g,
  },
  {
    name: "private key block",
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  },
  {
    name: "GitHub token",
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g,
  },
  {
    name: "OpenAI-style secret key",
    regex: /\bsk-[A-Za-z0-9_-]{32,}\b/g,
  },
  {
    name: "AWS access key id",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    name: "Slack token",
    regex: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
  },
];

const PLACEHOLDER_HINTS = ["YOUR_", "PLACEHOLDER", "EXAMPLE", "<keyId", "keyId.secret.instanceId", "keyId.keySecret.instanceId"];

/**
 * Scan text content for secret-like values.
 * @param {string} content
 * @param {string} label - file path used in findings
 * @returns {Array<{ label: string, pattern: string, match: string }>}
 */
export function scanContent(content, label) {
  const findings = [];
  for (const { name, regex } of PATTERNS) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const value = match[0];
      if (PLACEHOLDER_HINTS.some((hint) => value.includes(hint))) {
        continue;
      }
      findings.push({
        label,
        pattern: name,
        match: `${value.slice(0, 12)}…(redacted)`,
      });
    }
  }
  return findings;
}

/** File extensions worth scanning as text. */
export function isScannableFile(filePath) {
  return /\.(md|mjs|js|ts|tsx|json|jsonc|yml|yaml|txt|example|env|sh)$/i.test(filePath) || /\.env(\.|$)/i.test(filePath);
}
