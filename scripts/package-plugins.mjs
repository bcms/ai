#!/usr/bin/env node

/**
 * Copy-mode plugin packaging.
 *
 * The provider plugin trees under providers/<client>/plugin use symlinks into the
 * canonical skills/ and references/ folders. On Windows (or any environment
 * where symlinks are unavailable) publish the copies produced here instead:
 *
 *   node scripts/package-plugins.mjs        -> dist/packages/{cursor,claude}/
 *
 * Every symlink is materialised as a real file/directory copy, and skill
 * references are narrowed to the bundle set each skill actually ships.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { listCanonicalReferences, loadBundle, loadCatalog, repoRoot, resolveIncludeList } from "./lib/util.mjs";

const outputRoot = path.join(repoRoot, "dist", "packages");

async function copyTreeResolvingSymlinks(source, target) {
  const stat = await fs.lstat(source);

  if (stat.isSymbolicLink()) {
    const resolved = await fs.realpath(source);
    await copyTreeResolvingSymlinks(resolved, target);
    return;
  }

  if (stat.isDirectory()) {
    await fs.mkdir(target, { recursive: true });
    const entries = await fs.readdir(source);
    for (const entry of entries.sort()) {
      await copyTreeResolvingSymlinks(path.join(source, entry), path.join(target, entry));
    }
    return;
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

/**
 * The plugin skill folders symlink `references` to the full canonical set.
 * After copying, narrow each skill's references to its bundle include list so
 * the package matches what skills.sh installs ship.
 */
async function narrowSkillReferences(pluginTarget, bundle, allReferences) {
  const skillsDir = path.join(pluginTarget, "skills");
  for (const [skillName, config] of Object.entries(bundle)) {
    const referencesDir = path.join(skillsDir, skillName, "references");
    try {
      await fs.access(referencesDir);
    } catch {
      continue;
    }
    const keep = new Set(resolveIncludeList(config.include, allReferences));
    for (const fileName of await fs.readdir(referencesDir)) {
      if (!keep.has(fileName)) {
        await fs.rm(path.join(referencesDir, fileName), { recursive: true, force: true });
      }
    }
  }
}

async function main() {
  const catalog = await loadCatalog();
  const bundle = await loadBundle();
  const allReferences = await listCanonicalReferences();

  await fs.rm(outputRoot, { recursive: true, force: true });

  for (const [pluginKey, plugin] of Object.entries(catalog.plugins)) {
    const source = path.join(repoRoot, plugin.path);
    const shortName = pluginKey === "claude-code" ? "claude" : pluginKey;
    const target = path.join(outputRoot, shortName);

    await copyTreeResolvingSymlinks(source, target);
    await narrowSkillReferences(target, bundle, allReferences);

    // Plugin-root `references` symlink (legacy Cursor layout) also carries the
    // full canonical set; keep it complete since SKILL.md links may use it.
    console.log(`Packaged ${pluginKey} plugin -> ${path.relative(repoRoot, target)}/`);
  }

  console.log("Copy-mode plugin packages are ready (no symlinks; safe for Windows publishing).");
}

await main();
