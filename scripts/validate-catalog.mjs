#!/usr/bin/env node

/**
 * Validates catalog.json (the canonical version/distribution source) and
 * checks every other version declaration in the repo against it:
 *
 * - catalog shape and semver formats;
 * - plugin plugin.json + marketplace manifest versions match the catalog;
 * - CLI package.json version matches the catalog;
 * - CHANGELOG.md contains a heading for the pack version;
 * - install commands are well-formed;
 * - "published" claims have registry URLs;
 * - client support labels are valid and packaged/published claims have
 *   corresponding package or publication data.
 *
 * Run: node scripts/validate-catalog.mjs
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  createReporter,
  loadCatalog,
  pathExists,
  PUBLICATION_STATUSES,
  readJson,
  repoRoot,
  SEMVER_PATTERN,
  SUPPORT_LABELS,
} from "./lib/util.mjs";

const report = createReporter("Catalog validation");

const INSTALL_COMMAND_PATTERNS = {
  skillsSh: /^npx skills add bcms\/ai --skill [a-z0-9-]+$/,
  openclaw: /^openclaw skills install @bcms\/[a-z0-9-]+$/,
};

function checkSemver(value, label) {
  if (typeof value !== "string" || !SEMVER_PATTERN.test(value)) {
    report.error(`${label} must be a MAJOR.MINOR.PATCH version, got: ${JSON.stringify(value)}`);
    return false;
  }
  return true;
}

async function main() {
  const catalog = await loadCatalog();

  if (catalog.schemaVersion !== 1) {
    report.error(`catalog.json schemaVersion must be 1, got ${catalog.schemaVersion}.`);
  }
  if (typeof catalog.repository !== "string" || !catalog.repository.startsWith("https://github.com/")) {
    report.error("catalog.json repository must be a GitHub URL.");
  }
  checkSemver(catalog.packVersion, "catalog.json packVersion");

  for (const section of ["skills", "plugins", "cli", "mcp", "clients"]) {
    if (!catalog[section] || typeof catalog[section] !== "object") {
      report.error(`catalog.json is missing the "${section}" section.`);
    }
  }
  if (report.errorCount > 0) {
    report.finish();
    return;
  }

  // --- Skills -------------------------------------------------------------
  for (const [skillName, skill] of Object.entries(catalog.skills)) {
    const label = `catalog skills.${skillName}`;
    checkSemver(skill.version, `${label}.version`);

    if (!(await pathExists(path.join(repoRoot, skill.path, "SKILL.md")))) {
      report.error(`${label}.path (${skill.path}) does not contain a SKILL.md.`);
    }
    if (typeof skill.artifactBaseName !== "string" || !/^[a-z0-9-]+$/.test(skill.artifactBaseName)) {
      report.error(`${label}.artifactBaseName must be lowercase kebab-case.`);
    }

    for (const [channel, command] of Object.entries(skill.installCommands ?? {})) {
      const pattern = INSTALL_COMMAND_PATTERNS[channel];
      if (!pattern) {
        report.error(`${label}: unknown install channel "${channel}".`);
      } else if (!pattern.test(command)) {
        report.error(`${label}: malformed ${channel} install command: "${command}".`);
      }
    }

    for (const [registry, status] of Object.entries(skill.publication ?? {})) {
      if (!PUBLICATION_STATUSES.includes(status)) {
        report.error(`${label}: publication.${registry} must be one of ${PUBLICATION_STATUSES.join(", ")}.`);
      }
      if (status === "published" && !skill.registryUrls?.[registry]) {
        report.error(`${label}: publication.${registry} is "published" but registryUrls.${registry} is missing.`);
      }
    }

    for (const client of skill.compatibleClients ?? []) {
      if (!catalog.clients[client]) {
        report.error(`${label}: compatibleClients lists "${client}" which is not in the clients matrix.`);
      }
    }
  }

  // --- Plugins ------------------------------------------------------------
  for (const [pluginKey, plugin] of Object.entries(catalog.plugins)) {
    const label = `catalog plugins.${pluginKey}`;
    checkSemver(plugin.version, `${label}.version`);

    if (!PUBLICATION_STATUSES.includes(plugin.publicationStatus)) {
      report.error(`${label}.publicationStatus must be one of ${PUBLICATION_STATUSES.join(", ")}.`);
    }
    if (plugin.publicationStatus === "published" && !plugin.publicUrl) {
      report.error(`${label} is "published" but has no publicUrl.`);
    }

    const manifestPath = path.join(repoRoot, plugin.manifest);
    if (!(await pathExists(manifestPath))) {
      report.error(`${label}.manifest is missing: ${plugin.manifest}`);
      continue;
    }
    const manifest = await readJson(manifestPath);
    if (manifest.version !== plugin.version) {
      report.error(`${plugin.manifest} version ${manifest.version} differs from catalog version ${plugin.version}.`);
    }

    const marketplacePath = path.join(repoRoot, plugin.marketplaceManifest);
    if (!(await pathExists(marketplacePath))) {
      report.error(`${label}.marketplaceManifest is missing: ${plugin.marketplaceManifest}`);
      continue;
    }
    const marketplace = await readJson(marketplacePath);
    if (marketplace.metadata?.version !== plugin.version) {
      report.error(
        `${plugin.marketplaceManifest} metadata.version ${marketplace.metadata?.version} differs from catalog version ${plugin.version}.`,
      );
    }
    for (const entry of marketplace.plugins ?? []) {
      if (entry.version !== undefined && entry.version !== plugin.version) {
        report.error(
          `${plugin.marketplaceManifest} plugin entry "${entry.name}" version ${entry.version} differs from catalog version ${plugin.version}.`,
        );
      }
    }

    for (const skillName of plugin.skills ?? []) {
      if (!catalog.skills[skillName]) {
        report.error(`${label}: bundles unknown skill "${skillName}".`);
      }
      if (!(await pathExists(path.join(repoRoot, plugin.path, "skills", skillName, "SKILL.md")))) {
        report.error(`${label}: ${plugin.path}/skills/${skillName}/SKILL.md is missing.`);
      }
    }
  }

  // --- CLI ------------------------------------------------------------------
  checkSemver(catalog.cli.version, "catalog cli.version");
  const cliPackagePath = path.join(repoRoot, catalog.cli.path, "package.json");
  if (!(await pathExists(cliPackagePath))) {
    report.error(`CLI package.json is missing: ${catalog.cli.path}/package.json`);
  } else {
    const cliPackage = await readJson(cliPackagePath);
    if (cliPackage.version !== catalog.cli.version) {
      report.error(
        `${catalog.cli.path}/package.json version ${cliPackage.version} differs from catalog cli.version ${catalog.cli.version}.`,
      );
    }
    if (cliPackage.name !== catalog.cli.name) {
      report.error(`${catalog.cli.path}/package.json name ${cliPackage.name} differs from catalog cli.name ${catalog.cli.name}.`);
    }
  }
  if (!(await pathExists(path.join(repoRoot, catalog.cli.entry)))) {
    report.error(`catalog cli.entry is missing: ${catalog.cli.entry}`);
  }
  if (catalog.cli.skill && catalog.skills[catalog.cli.skill]?.version !== catalog.cli.version) {
    report.error(
      `catalog cli.version ${catalog.cli.version} differs from its skill "${catalog.cli.skill}" version ${catalog.skills[catalog.cli.skill]?.version}.`,
    );
  }

  // --- MCP --------------------------------------------------------------------
  for (const field of ["endpointTemplate", "transport", "authentication", "docsUrl"]) {
    if (typeof catalog.mcp[field] !== "string" || catalog.mcp[field].length === 0) {
      report.error(`catalog mcp.${field} is required.`);
    }
  }
  if (catalog.mcp.endpointTemplate && !catalog.mcp.endpointTemplate.includes("<")) {
    report.error("catalog mcp.endpointTemplate must contain a <placeholder>, never a real key.");
  }

  // --- Clients matrix -----------------------------------------------------------
  for (const [clientKey, client] of Object.entries(catalog.clients)) {
    const label = `catalog clients.${clientKey}`;
    if (!Array.isArray(client.support) || client.support.length === 0) {
      report.error(`${label}.support must be a non-empty array.`);
      continue;
    }
    for (const supportLabel of client.support) {
      if (!SUPPORT_LABELS.includes(supportLabel)) {
        report.error(`${label}.support has invalid label "${supportLabel}" (allowed: ${SUPPORT_LABELS.join(", ")}).`);
      }
    }
    if (client.support.includes("unsupported") && client.support.length > 1) {
      report.error(`${label}.support mixes "unsupported" with other labels.`);
    }
    if (client.support.includes("packaged")) {
      const hasPlugin = Object.values(catalog.plugins).some((plugin) => plugin.client === clientKey);
      if (!hasPlugin) {
        report.error(`${label} claims "packaged" but no plugin in the catalog targets it.`);
      }
    }
    if (client.support.includes("published")) {
      const viaPlugin = Object.values(catalog.plugins).some(
        (plugin) => plugin.client === clientKey && plugin.publicationStatus === "published",
      );
      const viaSkill = Object.values(catalog.skills).some((skill) =>
        Object.values(skill.publication ?? {}).includes("published"),
      );
      if (!viaPlugin && !viaSkill) {
        report.error(`${label} claims "published" but no plugin or skill publication backs it.`);
      }
    }
  }

  // --- Changelog ---------------------------------------------------------------
  const changelog = await fs.readFile(path.join(repoRoot, "CHANGELOG.md"), "utf8");
  if (!changelog.includes(`## [${catalog.packVersion}]`)) {
    report.error(`CHANGELOG.md has no "## [${catalog.packVersion}]" heading for the current pack version.`);
  }

  // Root package.json tracks the pack version.
  const rootPackage = await readJson(path.join(repoRoot, "package.json"));
  if (rootPackage.version !== catalog.packVersion) {
    report.error(`package.json version ${rootPackage.version} differs from catalog packVersion ${catalog.packVersion}.`);
  }

  report.finish();
}

await main();
