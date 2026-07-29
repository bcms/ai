#!/usr/bin/env node

/**
 * Builds the website-consumable release output at dist/agent-resources/:
 *
 *   release-manifest.json    — consumed by bcms/site (schemaVersion 1)
 *   agent-skills-index.json  — shaped for a future /.well-known/agent-skills/index.json
 *   artifacts/<skill>-<version>.zip — immutable versioned skill archives
 *   checksums.json           — SHA-256 per artifact
 *
 * Everything is generated from canonical sources: catalog.json (versions,
 * install commands, URLs, publication, client support), SKILL.md frontmatter
 * (descriptions), skills/bundle.json (bundled references), and the CLI's
 * exported command metadata. Archives are reproducible (sorted entries, fixed
 * timestamps, store method), so rebuilding without source changes yields
 * byte-identical zips.
 *
 * Usage:
 *   node scripts/build-agent-resources.mjs           # write dist/agent-resources/
 *   node scripts/build-agent-resources.mjs --check   # fail if committed output is stale
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { scanContent } from "./lib/secrets.mjs";
import {
  listCanonicalReferences,
  loadBundle,
  loadCatalog,
  parseFrontmatter,
  pathExists,
  readJson,
  repoRoot,
  resolveIncludeList,
  sha256,
} from "./lib/util.mjs";
import { createZip } from "./lib/zip.mjs";

const outputRoot = path.join(repoRoot, "dist", "agent-resources");

function generatedAt() {
  if (process.env.SOURCE_DATE_EPOCH) {
    return new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString();
  }
  return new Date().toISOString();
}

async function readSkillFrontmatter(skillPath) {
  const content = await fs.readFile(path.join(repoRoot, skillPath, "SKILL.md"), "utf8");
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter?.description) {
    throw new Error(`${skillPath}/SKILL.md is missing a frontmatter description.`);
  }
  return frontmatter;
}

/** Extra files (beyond SKILL.md + references + LICENSE) each skill archive ships. */
const EXTRA_ARCHIVE_FILES = {
  "bcms-content": ["cli/bcms.mjs", "package.json"],
};

async function buildSkillArchive(skillName, catalogSkill, bundle, allReferences) {
  const skillDir = path.join(repoRoot, catalogSkill.path);
  const includes = resolveIncludeList(bundle[skillName].include, allReferences);

  const entries = [];
  const addFile = async (archivePath, sourcePath) => {
    const data = await fs.readFile(sourcePath);
    const findings = scanContent(data.toString("utf8"), archivePath);
    if (findings.length > 0) {
      throw new Error(
        `Secret-like value found while packaging ${skillName} (${archivePath}): ${findings
          .map((finding) => finding.pattern)
          .join(", ")}`,
      );
    }
    entries.push({ path: archivePath, data });
  };

  await addFile("SKILL.md", path.join(skillDir, "SKILL.md"));
  for (const fileName of includes) {
    await addFile(`references/${fileName}`, path.join(repoRoot, "references", fileName));
  }
  await addFile("LICENSE", path.join(repoRoot, "LICENSE"));
  for (const extra of EXTRA_ARCHIVE_FILES[skillName] ?? []) {
    await addFile(extra, path.join(skillDir, extra));
  }

  // Embedded checksum metadata for consumers that unpack the archive.
  const archiveManifest = {
    schemaVersion: 1,
    name: skillName,
    version: catalogSkill.version,
    repository: (await loadCatalog()).repository,
    license: "MIT",
    files: entries.map((entry) => ({
      path: entry.path,
      sha256: sha256(entry.data),
      bytes: entry.data.length,
    })),
  };
  entries.push({ path: "manifest.json", data: Buffer.from(`${JSON.stringify(archiveManifest, null, 2)}\n`, "utf8") });

  const zip = createZip(entries);
  return {
    filename: `${catalogSkill.artifactBaseName}-${catalogSkill.version}.zip`,
    data: zip,
    sha256: sha256(zip),
    bytes: zip.length,
    includedReferences: includes,
  };
}

async function validatePluginForManifest(plugin) {
  const manifestPath = path.join(repoRoot, plugin.manifest);
  if (!(await pathExists(manifestPath))) {
    return "invalid";
  }
  const manifest = await readJson(manifestPath);
  if (manifest.version !== plugin.version) {
    return "invalid";
  }
  for (const skillName of plugin.skills ?? []) {
    if (!(await pathExists(path.join(repoRoot, plugin.path, "skills", skillName, "SKILL.md")))) {
      return "invalid";
    }
  }
  return "valid";
}

export async function buildOutputs() {
  const catalog = await loadCatalog();
  const bundle = await loadBundle();
  const allReferences = await listCanonicalReferences();

  const cliModule = await import(pathToFileURL(path.join(repoRoot, catalog.cli.entry)).href);

  const artifacts = new Map(); // archive filename -> { data, sha256, bytes }
  const skillEntries = [];

  for (const [skillName, catalogSkill] of Object.entries(catalog.skills)) {
    const frontmatter = await readSkillFrontmatter(catalogSkill.path);
    const archive = await buildSkillArchive(skillName, catalogSkill, bundle, allReferences);
    artifacts.set(archive.filename, archive);

    skillEntries.push({
      name: skillName,
      description: frontmatter.description,
      version: catalogSkill.version,
      path: catalogSkill.path,
      installCommands: catalogSkill.installCommands,
      urls: catalogSkill.registryUrls,
      publication: catalogSkill.publication,
      artifact: {
        filename: archive.filename,
        url: `${catalog.distBaseUrl}/artifacts/${archive.filename}`,
        sha256: archive.sha256,
        bytes: archive.bytes,
      },
      references: archive.includedReferences,
      compatibleClients: catalogSkill.compatibleClients,
    });
  }

  const pluginEntries = [];
  for (const plugin of Object.values(catalog.plugins)) {
    pluginEntries.push({
      client: plugin.client,
      name: plugin.name,
      version: plugin.version,
      path: plugin.path,
      installMethod: plugin.installMethod,
      publicUrl: plugin.publicUrl,
      publicationStatus: plugin.publicationStatus,
      skills: plugin.skills,
      validation: await validatePluginForManifest(plugin),
    });
  }

  const clientEntries = Object.entries(catalog.clients).map(([id, client]) => ({
    id,
    name: client.name,
    support: client.support,
    notes: client.notes,
  }));

  const releaseManifest = {
    schemaVersion: 1,
    generatedAt: generatedAt(),
    repository: catalog.repository,
    homepage: catalog.homepage,
    packVersion: catalog.packVersion,
    skills: skillEntries,
    clients: clientEntries,
    plugins: pluginEntries,
    mcp: catalog.mcp,
    cli: {
      name: catalog.cli.name,
      version: catalog.cli.version,
      path: catalog.cli.path,
      entry: catalog.cli.entry,
      skill: catalog.cli.skill,
      installMethod: catalog.cli.installMethod,
      jsonMode: catalog.cli.jsonMode,
      commands: Object.entries(cliModule.COMMANDS).map(([name, meta]) => ({
        name,
        summary: meta.summary,
        usage: meta.usage,
        readOnly: meta.readOnly,
        destructive: meta.destructive,
        retrySafe: meta.retrySafe,
        retryNote: meta.retryNote,
      })),
      errorCodes: cliModule.ERROR_CODES,
      exitCodes: cliModule.EXIT_CODES,
    },
  };

  const agentSkillsIndex = {
    schemaVersion: 1,
    generatedAt: releaseManifest.generatedAt,
    publisher: {
      name: "BCMS",
      url: "https://thebcms.com",
      repository: catalog.repository,
    },
    skills: skillEntries.map((skill) => ({
      name: skill.name,
      description: skill.description,
      version: skill.version,
      install: skill.installCommands,
      source: {
        repository: catalog.repository,
        path: skill.path,
      },
      artifact: skill.artifact,
    })),
  };

  const checksums = {};
  for (const [filename, artifact] of [...artifacts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    checksums[`artifacts/${filename}`] = artifact.sha256;
  }

  return { releaseManifest, agentSkillsIndex, checksums, artifacts };
}

function stripGeneratedAt(json) {
  const clone = JSON.parse(JSON.stringify(json));
  delete clone.generatedAt;
  return JSON.stringify(clone);
}

async function checkMode(outputs) {
  const problems = [];

  const compareJson = async (fileName, fresh) => {
    const target = path.join(outputRoot, fileName);
    if (!(await pathExists(target))) {
      problems.push(`${fileName} is missing`);
      return;
    }
    const committed = await readJson(target);
    if (stripGeneratedAt(committed) !== stripGeneratedAt(fresh)) {
      problems.push(`${fileName} is stale`);
    }
  };

  await compareJson("release-manifest.json", outputs.releaseManifest);
  await compareJson("agent-skills-index.json", outputs.agentSkillsIndex);
  await compareJson("checksums.json", outputs.checksums);

  for (const [filename, artifact] of outputs.artifacts) {
    const target = path.join(outputRoot, "artifacts", filename);
    if (!(await pathExists(target))) {
      problems.push(`artifacts/${filename} is missing`);
      continue;
    }
    const committed = await fs.readFile(target);
    if (sha256(committed) !== artifact.sha256) {
      problems.push(`artifacts/${filename} is stale (digest mismatch)`);
    }
  }

  // Old artifacts from previous versions must not linger (immutable names, one set per release).
  const artifactsDir = path.join(outputRoot, "artifacts");
  if (await pathExists(artifactsDir)) {
    for (const existing of await fs.readdir(artifactsDir)) {
      if (!outputs.artifacts.has(existing)) {
        problems.push(`artifacts/${existing} does not belong to the current release (run npm run package)`);
      }
    }
  }

  if (problems.length > 0) {
    console.error("Agent resources are out of date:");
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    console.error("Run: npm run package");
    process.exit(1);
  }
  console.log("dist/agent-resources/ is up to date.");
}

async function writeMode(outputs) {
  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(outputRoot, "artifacts"), { recursive: true });

  await fs.writeFile(path.join(outputRoot, "release-manifest.json"), `${JSON.stringify(outputs.releaseManifest, null, 2)}\n`);
  await fs.writeFile(path.join(outputRoot, "agent-skills-index.json"), `${JSON.stringify(outputs.agentSkillsIndex, null, 2)}\n`);
  await fs.writeFile(path.join(outputRoot, "checksums.json"), `${JSON.stringify(outputs.checksums, null, 2)}\n`);
  for (const [filename, artifact] of outputs.artifacts) {
    await fs.writeFile(path.join(outputRoot, "artifacts", filename), artifact.data);
  }

  console.log(`Wrote ${path.relative(repoRoot, outputRoot)}/`);
  for (const [filename, artifact] of outputs.artifacts) {
    console.log(`- artifacts/${filename} (${artifact.bytes} bytes, sha256 ${artifact.sha256.slice(0, 12)}…)`);
  }
}

async function main() {
  const outputs = await buildOutputs();
  if (process.argv.includes("--check")) {
    await checkMode(outputs);
  } else {
    await writeMode(outputs);
  }
}

await main();
