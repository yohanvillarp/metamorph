#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const CLI_PKG_PATH = join(ROOT_DIR, 'packages', '@nikelyh', 'cli', 'package.json');
const CLI_INDEX_PATH = join(ROOT_DIR, 'packages', '@nikelyh', 'cli', 'src', 'index.ts');
const CLI_CHANGELOG_PATH = join(ROOT_DIR, 'packages', '@nikelyh', 'cli', 'CHANGELOG.md');

function parseSemver(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) {
    throw new Error(`Invalid SemVer format: "${version}"`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
  };
}

function calculateNextVersion(currentVersion, bumpType) {
  const semver = parseSemver(currentVersion);

  switch (bumpType) {
    case 'patch':
      return `${semver.major}.${semver.minor}.${semver.patch + 1}`;
    case 'minor':
      return `${semver.major}.${semver.minor + 1}.0`;
    case 'major':
      return `${semver.major + 1}.0.0`;
    default:
      if (/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(bumpType)) {
        return bumpType;
      }
      throw new Error(`Invalid bump type or version target: "${bumpType}". Must be "patch", "minor", "major", or an explicit SemVer string (e.g. 2.2.0).`);
  }
}

function run() {
  const arg = process.argv[2];
  const pkgRaw = readFileSync(CLI_PKG_PATH, 'utf-8');
  const pkg = JSON.parse(pkgRaw);
  const currentVersion = pkg.version;

  if (!arg) {
    console.log(`\n\x1b[36mMetamorph Version Manager\x1b[0m`);
    console.log(`Current version: \x1b[32m${currentVersion}\x1b[0m\n`);
    console.log(`Usage:`);
    console.log(`  node scripts/bump-version.mjs <patch | minor | major | X.Y.Z>\n`);
    console.log(`Examples:`);
    console.log(`  node scripts/bump-version.mjs patch   # ${calculateNextVersion(currentVersion, 'patch')}`);
    console.log(`  node scripts/bump-version.mjs minor   # ${calculateNextVersion(currentVersion, 'minor')}`);
    console.log(`  node scripts/bump-version.mjs major   # ${calculateNextVersion(currentVersion, 'major')}`);
    console.log(`  node scripts/bump-version.mjs 2.2.0   # Explicit version\n`);
    process.exit(0);
  }

  const nextVersion = calculateNextVersion(currentVersion, arg.toLowerCase());

  console.log(`\n\x1b[34m[BUMP]\x1b[0m Preparing version bump: \x1b[33m${currentVersion}\x1b[0m -> \x1b[32m${nextVersion}\x1b[0m`);

  // 1. Update packages/@nikelyh/cli/package.json
  pkg.version = nextVersion;
  writeFileSync(CLI_PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  console.log(`\x1b[32m[OK]\x1b[0m Updated ${CLI_PKG_PATH}`);

  // 2. Update packages/@nikelyh/cli/src/index.ts
  const indexContent = readFileSync(CLI_INDEX_PATH, 'utf-8');
  const versionRegex = /\.version\(['"][^'"]+['"]\)/;
  if (!versionRegex.test(indexContent)) {
    throw new Error(`Could not find .version(...) declaration in ${CLI_INDEX_PATH}`);
  }
  const updatedIndex = indexContent.replace(versionRegex, `.version('${nextVersion}')`);
  writeFileSync(CLI_INDEX_PATH, updatedIndex, 'utf-8');
  console.log(`\x1b[32m[OK]\x1b[0m Updated ${CLI_INDEX_PATH} (.version('${nextVersion}'))`);

  // 3. Ensure CHANGELOG.md has header for nextVersion
  try {
    let changelog = readFileSync(CLI_CHANGELOG_PATH, 'utf-8');
    const headerRegex = new RegExp(`##\\s+${nextVersion.replace(/\./g, '\\.')}\\b`);
    if (!headerRegex.test(changelog)) {
      const firstEntryRegex = /(##\s+\d+\.\d+\.\d+)/;
      if (firstEntryRegex.test(changelog)) {
        const replacement = `## ${nextVersion}\n\n### Minor & Patch Changes\n\n- Release notes pending...\n\n$1`;
        changelog = changelog.replace(firstEntryRegex, replacement);
        writeFileSync(CLI_CHANGELOG_PATH, changelog, 'utf-8');
        console.log(`\x1b[32m[OK]\x1b[0m Prepended new release template to ${CLI_CHANGELOG_PATH}`);
      }
    }
  } catch (err) {
    console.warn(`\x1b[33m[WARN]\x1b[0m Could not update changelog automatically: ${err.message}`);
  }

  // 4. Synchronize package-lock.json
  console.log(`\x1b[34m[BUMP]\x1b[0m Synchronizing package-lock.json via npm install --package-lock-only...`);
  execSync('npm install --package-lock-only', { cwd: ROOT_DIR, stdio: 'inherit' });
  console.log(`\x1b[32m[OK]\x1b[0m package-lock.json synchronized`);

  console.log(`\n\x1b[32m[SUCCESS]\x1b[0m Successfully bumped @nikelyh/metamorph to \x1b[1m${nextVersion}\x1b[0m!\n`);
}

run();
