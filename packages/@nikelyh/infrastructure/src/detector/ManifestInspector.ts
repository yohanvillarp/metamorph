import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PackageManagerType } from '@nikelyh/domain';

export interface ManifestAnalysis {
  rawPackageJson?: Record<string, unknown>;
  allDependencies: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  packageManager: PackageManagerType;
  hasTsConfig: boolean;
  language: 'typescript' | 'javascript';
  pathAliases: Record<string, string[]>;
}

export function inspectManifest(projectPath: string): ManifestAnalysis {
  const pkgPath = join(projectPath, 'package.json');
  let rawPackageJson: Record<string, unknown> | undefined;
  let dependencies: Record<string, string> = {};
  let devDependencies: Record<string, string> = {};
  let scripts: Record<string, string> = {};

  if (existsSync(pkgPath)) {
    try {
      rawPackageJson = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      dependencies = (rawPackageJson?.dependencies as Record<string, string>) || {};
      devDependencies = (rawPackageJson?.devDependencies as Record<string, string>) || {};
      scripts = (rawPackageJson?.scripts as Record<string, string>) || {};
    } catch {
      // malformed package.json
    }
  }

  const allDependencies = {
    ...devDependencies,
    ...dependencies,
  };

  // Detect Package Manager via lockfile
  let packageManager: PackageManagerType = 'npm';
  if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) {
    packageManager = 'pnpm';
  } else if (existsSync(join(projectPath, 'yarn.lock'))) {
    packageManager = 'yarn';
  } else if (existsSync(join(projectPath, 'bun.lockb')) || existsSync(join(projectPath, 'bun.lock'))) {
    packageManager = 'bun';
  } else if (rawPackageJson?.packageManager && typeof rawPackageJson.packageManager === 'string') {
    const pm = rawPackageJson.packageManager.toLowerCase();
    if (pm.startsWith('pnpm')) packageManager = 'pnpm';
    else if (pm.startsWith('yarn')) packageManager = 'yarn';
    else if (pm.startsWith('bun')) packageManager = 'bun';
  }

  // Detect TSConfig and path aliases
  let hasTsConfig = false;
  let pathAliases: Record<string, string[]> = {};
  const tsConfigPath = join(projectPath, 'tsconfig.json');

  if (existsSync(tsConfigPath)) {
    hasTsConfig = true;
    try {
      // Strip comments for basic JSON parsing of tsconfig
      const content = readFileSync(tsConfigPath, 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '');
      const tsconfig = JSON.parse(content);
      if (tsconfig?.compilerOptions?.paths) {
        pathAliases = tsconfig.compilerOptions.paths;
      }
    } catch {
      // tsconfig parse fallback
    }
  }

  const hasTsDependency = !!(allDependencies['typescript'] || allDependencies['ts-node'] || allDependencies['tsx']);
  const language: 'typescript' | 'javascript' = (hasTsConfig || hasTsDependency) ? 'typescript' : 'javascript';

  return {
    rawPackageJson,
    allDependencies,
    dependencies,
    devDependencies,
    scripts,
    packageManager,
    hasTsConfig,
    language,
    pathAliases,
  };
}
