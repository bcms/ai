#!/usr/bin/env node

/**
 * Scans skill sources, references, plugin packages, scripts, and generated
 * agent resources for secret-like values (API keys, tokens, private keys,
 * real-looking mcpKey/Authorization values). Placeholders such as
 * YOUR_MCP_KEY_HERE and keyId.secret.instanceId are allowed.
 *
 * Run: node scripts/scan-secrets.mjs [extra paths…]
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { isScannableFile, scanContent } from "./lib/secrets.mjs";
import { pathExists, repoRoot } from "./lib/util.mjs";

const DEFAULT_TARGETS = ["skills", "references", "providers", "scripts", "dist/agent-resources", "README.md", "AGENTS.md", "CHANGELOG.md", "catalog.json"];

const SKIP_NAMES = new Set(["node_modules", "package-lock.json", ".git"]);

async function collectFiles(targetPath) {
  const stat = await fs.lstat(targetPath);
  if (stat.isSymbolicLink()) {
    return []; // symlinked content is scanned via its canonical location
  }
  if (stat.isFile()) {
    return [targetPath];
  }
  if (!stat.isDirectory()) {
    return [];
  }
  const files = [];
  for (const entry of await fs.readdir(targetPath)) {
    if (SKIP_NAMES.has(entry)) {
      continue;
    }
    files.push(...(await collectFiles(path.join(targetPath, entry))));
  }
  return files;
}

async function main() {
  const extraTargets = process.argv.slice(2);
  const targets = extraTargets.length > 0 ? extraTargets : DEFAULT_TARGETS;
  const findings = [];
  let scanned = 0;

  for (const target of targets) {
    const absolute = path.resolve(repoRoot, target);
    if (!(await pathExists(absolute))) {
      continue;
    }
    for (const filePath of await collectFiles(absolute)) {
      if (!isScannableFile(filePath)) {
        continue;
      }
      scanned++;
      const content = await fs.readFile(filePath, "utf8");
      findings.push(...scanContent(content, path.relative(repoRoot, filePath)));
    }
  }

  if (findings.length > 0) {
    console.error(`Secret scan failed (${findings.length} finding(s) in ${scanned} scanned files):`);
    for (const finding of findings) {
      console.error(`- ${finding.label}: ${finding.pattern} — ${finding.match}`);
    }
    process.exit(1);
  }

  console.log(`Secret scan passed (${scanned} files scanned).`);
}

await main();
