#!/usr/bin/env node

/**
 * Validates the canonical skills against catalog.json and skills/bundle.json:
 *
 * - every skills/<name>/ directory with a SKILL.md has a bundle.json AND a
 *   catalog.json entry (and vice versa) — missing entries fail;
 * - SKILL.md frontmatter has name, description, and a version that matches
 *   the canonical version in catalog.json;
 * - bundled reference copies exist for every include;
 * - relative links inside SKILL.md and bundled references resolve within the
 *   installed skill folder (skills.sh / ClawHub installs copy only that
 *   folder, so escaping links break) — broken links fail;
 * - canonical references/ files not bundled by any skill produce warnings.
 *
 * Run: node scripts/validate-skills.mjs
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  createReporter,
  extractRelativeLinks,
  listCanonicalReferences,
  loadBundle,
  loadCatalog,
  parseFrontmatter,
  pathExists,
  repoRoot,
  resolveIncludeList,
} from "./lib/util.mjs";

const report = createReporter("Skill validation");

async function listSkillDirs() {
  const skillsRoot = path.join(repoRoot, "skills");
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (await pathExists(path.join(skillsRoot, entry.name, "SKILL.md"))) {
      dirs.push(entry.name);
    }
  }
  return dirs.sort();
}

async function validateLinks(filePath, skillDir, label) {
  const content = await fs.readFile(filePath, "utf8");
  for (const target of extractRelativeLinks(content)) {
    const resolvedFromFile = path.resolve(path.dirname(filePath), target);
    if (!resolvedFromFile.startsWith(skillDir + path.sep) && resolvedFromFile !== skillDir) {
      report.error(
        `${label}: link "${target}" escapes the skill folder and will break after installation. Use an absolute URL instead.`,
      );
      continue;
    }
    if (!(await pathExists(resolvedFromFile))) {
      report.error(`${label}: broken relative link "${target}".`);
    }
  }
}

async function main() {
  const catalog = await loadCatalog();
  const bundle = await loadBundle();
  const allReferences = await listCanonicalReferences();
  const skillDirs = await listSkillDirs();

  // Coverage in both directions.
  for (const skillName of skillDirs) {
    if (!bundle[skillName]) {
      report.error(`skills/${skillName}/ has a SKILL.md but no entry in skills/bundle.json.`);
    }
    if (!catalog.skills[skillName]) {
      report.error(`skills/${skillName}/ has a SKILL.md but no entry in catalog.json.`);
    }
  }
  for (const skillName of Object.keys(bundle)) {
    if (!skillDirs.includes(skillName)) {
      report.error(`skills/bundle.json declares "${skillName}" but skills/${skillName}/SKILL.md is missing.`);
    }
  }
  for (const skillName of Object.keys(catalog.skills)) {
    if (!skillDirs.includes(skillName)) {
      report.error(`catalog.json declares skill "${skillName}" but skills/${skillName}/SKILL.md is missing.`);
    }
  }

  const usedReferences = new Set();

  for (const skillName of skillDirs) {
    const config = bundle[skillName];
    const catalogEntry = catalog.skills[skillName];
    if (!config || !catalogEntry) {
      continue;
    }

    const skillDir = path.join(repoRoot, catalogEntry.path);
    const skillFile = path.join(skillDir, "SKILL.md");

    const frontmatter = parseFrontmatter(await fs.readFile(skillFile, "utf8"));
    if (!frontmatter) {
      report.error(`${skillName}: SKILL.md is missing YAML frontmatter.`);
      continue;
    }
    if (frontmatter.name !== skillName) {
      report.error(`${skillName}: frontmatter "name" is "${frontmatter.name}", expected "${skillName}".`);
    }
    if (!frontmatter.description) {
      report.error(`${skillName}: frontmatter "description" is missing.`);
    }
    if (!frontmatter.version) {
      report.error(`${skillName}: frontmatter "version" is missing (canonical version is ${catalogEntry.version}).`);
    } else if (frontmatter.version !== catalogEntry.version) {
      report.error(
        `${skillName}: frontmatter version ${frontmatter.version} differs from catalog.json version ${catalogEntry.version}.`,
      );
    }

    let includes;
    try {
      includes = resolveIncludeList(config.include, allReferences);
    } catch (error) {
      report.error(`${skillName}: ${error.message}`);
      continue;
    }

    for (const fileName of includes) {
      usedReferences.add(fileName);
      if (!(await pathExists(path.join(repoRoot, "references", fileName)))) {
        report.error(`${skillName}: bundle includes missing canonical reference references/${fileName}.`);
      }
      const bundledCopy = path.join(skillDir, "references", fileName);
      if (!(await pathExists(bundledCopy))) {
        report.error(
          `${skillName}: bundled copy ${catalogEntry.path}/references/${fileName} is missing — run node scripts/sync-skill-references.mjs.`,
        );
        continue;
      }
      await validateLinks(bundledCopy, skillDir, `${skillName} (${catalogEntry.path}/references/${fileName})`);
    }

    await validateLinks(skillFile, skillDir, `${skillName} (${catalogEntry.path}/SKILL.md)`);
  }

  for (const fileName of allReferences) {
    if (!usedReferences.has(fileName)) {
      report.warn(`references/${fileName} is not bundled by any skill (check skills/bundle.json).`);
    }
  }

  report.finish();
}

await main();
