/**
 * Shared helpers for the BCMS AI skill pack tooling.
 * catalog.json at the repo root is the canonical source for versions,
 * install commands, registry URLs, publication status, and client support.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export const SUPPORT_LABELS = ["tested", "packaged", "published", "documented", "experimental", "unsupported"];

export const PUBLICATION_STATUSES = ["published", "packaged", "unpublished"];

export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function loadCatalog() {
  return readJson(path.join(repoRoot, "catalog.json"));
}

export async function loadBundle() {
  return readJson(path.join(repoRoot, "skills", "bundle.json"));
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function hashFile(filePath) {
  return sha256(await fs.readFile(filePath));
}

/** Recursively list files under a directory (relative paths, sorted). */
export async function walkFiles(dirPath, base = dirPath) {
  const results = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkFiles(entryPath, base)));
    } else {
      results.push(path.relative(base, entryPath));
    }
  }
  return results.sort();
}

/**
 * Parse simple YAML frontmatter from a markdown file.
 * Supports scalar values and `key: >`-style folded blocks (as used by SKILL.md).
 */
export function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return null;
  }
  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    return null;
  }
  const block = normalized.slice(4, closingIndex);
  const fields = {};
  let currentKey = null;
  let folded = [];

  const flush = () => {
    if (currentKey !== null) {
      fields[currentKey] = folded.join(" ").trim();
      currentKey = null;
      folded = [];
    }
  };

  for (const line of block.split("\n")) {
    if (/^\s/.test(line) && currentKey !== null) {
      folded.push(line.trim());
      continue;
    }
    flush();
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (value === ">" || value === "|" || value === ">-" || value === "|-") {
      currentKey = key;
      folded = [];
    } else {
      fields[key] = value;
    }
  }
  flush();
  return fields;
}

/** Extract relative markdown link/image targets (skips http(s), mailto, and pure anchors). */
export function extractRelativeLinks(markdown) {
  const links = [];
  const pattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = pattern.exec(markdown)) !== null) {
    const target = match[1];
    if (
      target.startsWith("http://") ||
      target.startsWith("https://") ||
      target.startsWith("mailto:") ||
      target.startsWith("#")
    ) {
      continue;
    }
    links.push(target.split("#")[0]);
  }
  return links.filter((target) => target.length > 0);
}

/** Resolve the reference files a skill bundles, honoring the `"*"` wildcard. */
export function resolveIncludeList(include, allReferences) {
  if (!Array.isArray(include) || include.length === 0) {
    throw new Error('Each skill must declare a non-empty "include" array.');
  }
  if (include.includes("*")) {
    return [...allReferences].sort();
  }
  return [...new Set(include)].sort();
}

export async function listCanonicalReferences() {
  const referencesRoot = path.join(repoRoot, "references");
  const entries = await fs.readdir(referencesRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
}

/** Minimal reporter shared by the validation scripts. */
export function createReporter(title) {
  const errors = [];
  const warnings = [];
  return {
    error: (message) => errors.push(message),
    warn: (message) => warnings.push(message),
    get errorCount() {
      return errors.length;
    },
    finish() {
      if (warnings.length > 0) {
        console.log(`${title} warnings:`);
        for (const warning of warnings) {
          console.log(`- ${warning}`);
        }
      }
      if (errors.length > 0) {
        console.error(`${title} failed:`);
        for (const error of errors) {
          console.error(`- ${error}`);
        }
        process.exit(1);
      }
      console.log(`${title} passed.`);
    },
  };
}
