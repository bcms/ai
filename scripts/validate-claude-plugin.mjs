#!/usr/bin/env node

/**
 * Validates .claude-plugin/marketplace.json and the bundled Claude Code plugin:
 *
 * - marketplace manifest shape and plugin source paths;
 * - plugin.json exists with required fields;
 * - bundled skills have SKILL.md with name + description frontmatter;
 * - every symlink inside the plugin tree resolves;
 * - versions match catalog.json.
 *
 * Run: node scripts/validate-claude-plugin.mjs
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { createReporter, loadCatalog, parseFrontmatter, pathExists, readJson, repoRoot } from "./lib/util.mjs";

const report = createReporter("Claude plugin validation");

async function checkSymlinks(dirPath, label) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        await fs.stat(entryPath); // follows the link; throws when broken
      } catch {
        report.error(`${label}: broken symlink ${path.relative(repoRoot, entryPath)}`);
        continue;
      }
      const resolved = await fs.realpath(entryPath);
      if (!resolved.startsWith(repoRoot + path.sep)) {
        report.error(`${label}: symlink ${path.relative(repoRoot, entryPath)} escapes the repository.`);
      }
    } else if (entry.isDirectory()) {
      await checkSymlinks(entryPath, label);
    }
  }
}

async function main() {
  const catalog = await loadCatalog();
  const pluginConfig = catalog.plugins["claude-code"];
  if (!pluginConfig) {
    report.error("catalog.json has no plugins.claude-code entry.");
    report.finish();
    return;
  }

  const marketplacePath = path.join(repoRoot, pluginConfig.marketplaceManifest);
  if (!(await pathExists(marketplacePath))) {
    report.error(`Marketplace manifest is missing: ${pluginConfig.marketplaceManifest}`);
    report.finish();
    return;
  }
  const marketplace = await readJson(marketplacePath);

  if (typeof marketplace.name !== "string" || marketplace.name.length === 0) {
    report.error('Marketplace "name" is required.');
  }
  if (!marketplace.owner?.name) {
    report.error('Marketplace "owner.name" is required.');
  }
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    report.error('Marketplace "plugins" must be a non-empty array.');
    report.finish();
    return;
  }

  for (const [index, entry] of marketplace.plugins.entries()) {
    const label = `plugins[${index}] (${entry.name ?? "?"})`;

    if (typeof entry.name !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(entry.name)) {
      report.error(`${label}: "name" must be lowercase kebab-case.`);
      continue;
    }
    if (typeof entry.source !== "string" || entry.source.includes("..")) {
      report.error(`${label}: "source" must be a safe relative path.`);
      continue;
    }

    const pluginDir = path.resolve(repoRoot, entry.source);
    if (!(await pathExists(pluginDir))) {
      report.error(`${label}: source directory is missing: ${entry.source}`);
      continue;
    }

    const manifestPath = path.join(pluginDir, ".claude-plugin", "plugin.json");
    if (!(await pathExists(manifestPath))) {
      report.error(`${label}: ${entry.source}/.claude-plugin/plugin.json is missing.`);
      continue;
    }
    const manifest = await readJson(manifestPath);

    if (manifest.name !== entry.name) {
      report.error(`${label}: plugin.json name "${manifest.name}" does not match marketplace entry name.`);
    }
    if (!manifest.description) {
      report.error(`${label}: plugin.json "description" is required.`);
    }
    if (manifest.version !== pluginConfig.version) {
      report.error(`${label}: plugin.json version ${manifest.version} differs from catalog version ${pluginConfig.version}.`);
    }
    if (entry.version !== undefined && entry.version !== pluginConfig.version) {
      report.error(`${label}: marketplace entry version ${entry.version} differs from catalog version ${pluginConfig.version}.`);
    }

    await checkSymlinks(pluginDir, label);

    // Bundled skills must be complete.
    for (const skillName of pluginConfig.skills ?? []) {
      const skillFile = path.join(pluginDir, "skills", skillName, "SKILL.md");
      if (!(await pathExists(skillFile))) {
        report.error(`${label}: bundled skill "${skillName}" is missing SKILL.md.`);
        continue;
      }
      const frontmatter = parseFrontmatter(await fs.readFile(skillFile, "utf8"));
      if (!frontmatter?.name || !frontmatter?.description) {
        report.error(`${label}: skill "${skillName}" SKILL.md is missing name/description frontmatter.`);
      }
      const referencesDir = path.join(pluginDir, "skills", skillName, "references");
      if (!(await pathExists(referencesDir))) {
        report.error(`${label}: skill "${skillName}" has no references/ directory.`);
      }
    }
  }

  report.finish();
}

await main();
