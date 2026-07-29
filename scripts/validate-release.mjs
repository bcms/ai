#!/usr/bin/env node

/**
 * Full release gate — run in CI as `npm run validate:release`. Fails when:
 *
 * - generated skill references are stale (sync --check);
 * - skill bundles, frontmatter versions, or relative links are broken;
 * - any version declaration disagrees with catalog.json;
 * - the changelog omits the released pack version;
 * - a plugin package is invalid (manifest, files, symlinks, versions);
 * - secret-like values appear in sources or artifacts;
 * - dist/agent-resources/ is stale, archives cannot be rebuilt, or SHA-256
 *   digests do not match;
 * - the committed release manifest is structurally invalid or misses public
 *   URLs for published entries;
 * - CLI JSON tests fail.
 *
 * Add --online to also HEAD-check the published registry URLs.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

import { pathExists, readJson, repoRoot } from "./lib/util.mjs";

const online = process.argv.includes("--online");
let failed = false;

function runStep(title, args) {
  console.log(`\n=== ${title}`);
  const result = spawnSync(process.execPath, args, { cwd: repoRoot, stdio: "inherit" });
  if (result.status !== 0) {
    failed = true;
    console.error(`Step failed: ${title}`);
  }
}

function fail(message) {
  failed = true;
  console.error(`- ${message}`);
}

async function validateManifestShape() {
  console.log("\n=== Release manifest shape");
  const manifestPath = path.join(repoRoot, "dist", "agent-resources", "release-manifest.json");
  if (!(await pathExists(manifestPath))) {
    fail("dist/agent-resources/release-manifest.json is missing — run npm run package.");
    return;
  }
  const manifest = await readJson(manifestPath);

  if (manifest.schemaVersion !== 1) {
    fail(`release manifest schemaVersion must be 1, got ${manifest.schemaVersion}.`);
  }
  for (const key of ["generatedAt", "repository", "packVersion", "skills", "clients", "plugins", "mcp", "cli"]) {
    if (manifest[key] === undefined) {
      fail(`release manifest is missing "${key}".`);
    }
  }

  for (const skill of manifest.skills ?? []) {
    for (const key of ["name", "description", "version", "path", "installCommands", "urls", "publication", "artifact", "references", "compatibleClients"]) {
      if (skill[key] === undefined) {
        fail(`release manifest skill "${skill.name ?? "?"}" is missing "${key}".`);
      }
    }
    if (skill.artifact && (!skill.artifact.url || !skill.artifact.sha256 || !skill.artifact.filename)) {
      fail(`release manifest skill "${skill.name}" artifact must declare filename, url, and sha256.`);
    }
    for (const [registry, status] of Object.entries(skill.publication ?? {})) {
      if (status === "published" && !skill.urls?.[registry]) {
        fail(`release manifest skill "${skill.name}" is published on ${registry} but has no public URL.`);
      }
    }
    const artifactFile = path.join(repoRoot, "dist", "agent-resources", "artifacts", skill.artifact?.filename ?? "");
    if (skill.artifact?.filename && !(await pathExists(artifactFile))) {
      fail(`release manifest references missing artifact ${skill.artifact.filename}.`);
    }
  }

  for (const plugin of manifest.plugins ?? []) {
    if (plugin.validation !== "valid") {
      fail(`release manifest plugin "${plugin.client}" has validation status "${plugin.validation}".`);
    }
    if (plugin.publicationStatus === "published" && !plugin.publicUrl) {
      fail(`release manifest plugin "${plugin.client}" is published but has no publicUrl.`);
    }
  }

  const cli = manifest.cli ?? {};
  if (!Array.isArray(cli.commands) || cli.commands.length === 0) {
    fail("release manifest cli.commands must be a non-empty array.");
  }
  if (cli.jsonMode !== true) {
    fail("release manifest cli.jsonMode must be true (machine mode is a release requirement).");
  }

  if (!failed) {
    console.log("Release manifest shape passed.");
  }
}

async function checkPublicUrls() {
  if (!online) {
    console.log("\n=== Public URL reachability (skipped — pass --online to enable)");
    return;
  }
  console.log("\n=== Public URL reachability");
  const manifest = await readJson(path.join(repoRoot, "dist", "agent-resources", "release-manifest.json"));
  const urls = new Set();
  for (const skill of manifest.skills ?? []) {
    for (const [registry, status] of Object.entries(skill.publication ?? {})) {
      if (status === "published" && skill.urls?.[registry]) {
        urls.add(skill.urls[registry]);
      }
    }
  }
  for (const url of urls) {
    try {
      const response = await fetch(url, { method: "HEAD", redirect: "follow" });
      if (!response.ok) {
        fail(`published URL returned HTTP ${response.status}: ${url}`);
      } else {
        console.log(`- ok: ${url}`);
      }
    } catch (error) {
      fail(`published URL unreachable: ${url} (${error.message})`);
    }
  }
}

runStep("Reference sync check", ["scripts/sync-skill-references.mjs", "--check"]);
runStep("Skill validation (bundles, versions, links)", ["scripts/validate-skills.mjs"]);
runStep("Catalog / version consistency", ["scripts/validate-catalog.mjs"]);
runStep("Cursor plugin package", ["scripts/validate-cursor-plugin.mjs"]);
runStep("Claude Code plugin package", ["scripts/validate-claude-plugin.mjs"]);
runStep("Secret scan", ["scripts/scan-secrets.mjs"]);
runStep("Agent resources staleness (archives + digests)", ["scripts/build-agent-resources.mjs", "--check"]);
await validateManifestShape();
await checkPublicUrls();
runStep("CLI tests (JSON mode, exit codes, errors)", ["--test", "skills/bcms-content/test/cli.test.mjs"]);

if (failed) {
  console.error("\nRelease validation FAILED.");
  process.exit(1);
}
console.log("\nRelease validation passed.");
