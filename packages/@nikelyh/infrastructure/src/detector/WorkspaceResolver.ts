import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import type { MonorepoContext, WorkspacePackage } from '@nikelyh/domain';

/**
 * Traverses upwards from a given directory to find the nearest directory containing package.json.
 * If not found or if already at git root / filesystem root, returns the original path.
 */
export function resolveProjectRoot(startPath: string): string {
  let current = resolve(startPath);
  const root = resolve('/');

  while (current && current !== root && current !== dirname(current)) {
    if (existsSync(join(current, 'package.json'))) {
      return current;
    }
    // If we reach a git boundary without finding a package.json, stop.
    if (existsSync(join(current, '.git'))) {
      break;
    }
    current = dirname(current);
  }

  return resolve(startPath);
}

/**
 * Parses workspace patterns (e.g. ['apps/*', 'packages/*']) and locates member packages.
 */
function findWorkspacePackages(rootDir: string, patterns: string[]): WorkspacePackage[] {
  const packages: WorkspacePackage[] = [];

  for (const pattern of patterns) {
    const cleanPattern = pattern.replace(/[\\/]+$/, '');
    if (cleanPattern.endsWith('/*')) {
      const parentDir = join(rootDir, cleanPattern.slice(0, -2));
      if (existsSync(parentDir)) {
        try {
          const entries = readdirSync(parentDir);
          for (const entry of entries) {
            const subDir = join(parentDir, entry);
            const pkgJsonPath = join(subDir, 'package.json');
            if (existsSync(pkgJsonPath) && statSync(subDir).isDirectory()) {
              try {
                const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
                packages.push({
                  name: pkg.name || entry,
                  relativePath: join(cleanPattern.slice(0, -2), entry).replace(/\\/g, '/'),
                  absolutePath: subDir,
                });
              } catch {
                // skip malformed
              }
            }
          }
        } catch {
          // ignore directory read errors
        }
      }
    } else {
      // Direct directory pattern (e.g. "client", "backend")
      const subDir = join(rootDir, cleanPattern);
      const pkgJsonPath = join(subDir, 'package.json');
      if (existsSync(pkgJsonPath) && statSync(subDir).isDirectory()) {
        try {
          const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
          packages.push({
            name: pkg.name || cleanPattern,
            relativePath: cleanPattern.replace(/\\/g, '/'),
            absolutePath: subDir,
          });
        } catch {
          // skip malformed
        }
      }
    }
  }

  return packages;
}

/**
 * Inspects a directory to determine if it is a monorepo root and discovers its member packages.
 */
export function detectMonorepo(projectPath: string): MonorepoContext {
  const rootPath = resolve(projectPath);
  const pkgPath = join(rootPath, 'package.json');
  let tool: MonorepoContext['tool'];
  let patterns: string[] = [];

  // Check pnpm-workspace.yaml
  const pnpmWorkspacePath = join(rootPath, 'pnpm-workspace.yaml');
  if (existsSync(pnpmWorkspacePath)) {
    tool = 'pnpm';
    try {
      const content = readFileSync(pnpmWorkspacePath, 'utf-8');
      // Simple yaml parse for packages: - 'apps/*'
      const lines = content.split('\n');
      let inPackages = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('packages:')) {
          inPackages = true;
          continue;
        }
        if (inPackages) {
          if (trimmed.startsWith('-')) {
            const pattern = trimmed.replace(/^-\s*['"]?/, '').replace(/['"]?\s*$/, '');
            if (pattern) patterns.push(pattern);
          } else if (trimmed && !trimmed.startsWith('#')) {
            break;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Check package.json workspaces
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.workspaces) {
        if (Array.isArray(pkg.workspaces)) {
          patterns.push(...pkg.workspaces);
        } else if (Array.isArray(pkg.workspaces.packages)) {
          patterns.push(...pkg.workspaces.packages);
        }
        if (!tool) tool = 'npm';
      }
    } catch {
      // ignore
    }
  }

  // Check turbo.json
  if (existsSync(join(rootPath, 'turbo.json'))) {
    tool = 'turbo';
  }

  // Check lerna.json
  if (existsSync(join(rootPath, 'lerna.json'))) {
    if (!tool) tool = 'lerna';
    try {
      const lerna = JSON.parse(readFileSync(join(rootPath, 'lerna.json'), 'utf-8'));
      if (Array.isArray(lerna.packages)) {
        patterns.push(...lerna.packages);
      }
    } catch {
      // ignore
    }
  }

  // Check nx.json
  if (existsSync(join(rootPath, 'nx.json'))) {
    if (!tool) tool = 'nx';
  }

  // Default fallback workspace patterns if tooling was detected without explicit patterns
  if (tool && patterns.length === 0) {
    patterns = ['apps/*', 'packages/*', 'services/*'];
  }

  const uniquePatterns = Array.from(new Set(patterns));
  const packages = findWorkspacePackages(rootPath, uniquePatterns);

  return {
    isMonorepo: !!tool || packages.length > 0,
    tool,
    packages,
    rootPath,
  };
}
