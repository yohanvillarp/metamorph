import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { BundlerType, RouterVariant } from '@nikelyh/domain';

export interface StructureAnalysis {
  routerVariant: RouterVariant;
  bundler: BundlerType;
  existingConfigFiles: string[];
  extensionCounts: {
    vue: number;
    svelte: number;
    reactJsx: number;
    nestDecorators: number;
  };
}

/**
 * Checks if any of the relative paths exist inside the project root.
 */
function hasAnyFile(projectPath: string, relativePaths: string[]): string | undefined {
  for (const rel of relativePaths) {
    if (existsSync(join(projectPath, rel))) {
      return rel;
    }
  }
  return undefined;
}

/**
 * Performs a shallow/bounded scan of src (up to depth 3) to count characteristic extensions.
 */
function scanCharacteristicExtensions(projectPath: string): StructureAnalysis['extensionCounts'] {
  const counts = {
    vue: 0,
    svelte: 0,
    reactJsx: 0,
    nestDecorators: 0,
  };

  const srcDir = existsSync(join(projectPath, 'src')) ? join(projectPath, 'src') : projectPath;
  if (!existsSync(srcDir)) return counts;

  function traverse(dir: string, depth: number) {
    if (depth > 3) return;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'build' || entry === '.next') {
          continue;
        }
        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            traverse(fullPath, depth + 1);
          } else if (stat.isFile()) {
            const lower = entry.toLowerCase();
            if (lower.endsWith('.vue')) counts.vue++;
            else if (lower.endsWith('.svelte')) counts.svelte++;
            else if (lower.endsWith('.tsx') || lower.endsWith('.jsx')) counts.reactJsx++;
            else if (lower.endsWith('.controller.ts') || lower.endsWith('.module.ts')) counts.nestDecorators++;
          }
        } catch {
          // ignore stat errors
        }
      }
    } catch {
      // ignore readdir errors
    }
  }

  traverse(srcDir, 0);
  return counts;
}

export function inspectStructure(
  projectPath: string,
  deps: Record<string, string>,
  scripts: Record<string, string>
): StructureAnalysis {
  const existingConfigFiles: string[] = [];

  // Known config files to check
  const candidateConfigs = [
    'next.config.js',
    'next.config.mjs',
    'next.config.ts',
    'next.config.cjs',
    'vite.config.ts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.cjs',
    'svelte.config.js',
    'svelte.config.ts',
    'angular.json',
    'nest-cli.json',
    'webpack.config.js',
    'webpack.config.ts',
    'vue.config.js',
  ];

  for (const config of candidateConfigs) {
    if (existsSync(join(projectPath, config))) {
      existingConfigFiles.push(config);
    }
  }

  // Detect Bundler
  let bundler: BundlerType = 'unknown';
  if (existingConfigFiles.some(c => c.startsWith('vite.config'))) {
    bundler = 'vite';
  } else if (existingConfigFiles.includes('angular.json')) {
    bundler = 'angular-cli';
  } else if (deps['next'] || existingConfigFiles.some(c => c.startsWith('next.config'))) {
    // Check if next scripts mention turbo
    const scriptValues = Object.values(scripts).join(' ');
    bundler = scriptValues.includes('--turbo') ? 'turbopack' : 'webpack';
  } else if (existingConfigFiles.some(c => c.startsWith('webpack.config')) || deps['webpack']) {
    bundler = 'webpack';
  } else if (deps['vite']) {
    bundler = 'vite';
  } else if (deps['esbuild']) {
    bundler = 'esbuild';
  } else if (deps['rollup']) {
    bundler = 'rollup';
  }

  // Detect Router Variant
  let routerVariant: RouterVariant = 'none';

  // Next.js Router detection
  const hasAppRouter = hasAnyFile(projectPath, [
    'src/app/layout.tsx',
    'src/app/layout.js',
    'src/app/page.tsx',
    'src/app/page.js',
    'app/layout.tsx',
    'app/layout.js',
    'app/page.tsx',
    'app/page.js',
  ]);

  const hasPagesRouter = hasAnyFile(projectPath, [
    'src/pages/_app.tsx',
    'src/pages/_app.js',
    'src/pages/index.tsx',
    'src/pages/index.js',
    'pages/_app.tsx',
    'pages/_app.js',
    'pages/index.tsx',
    'pages/index.js',
  ]);

  if (hasAppRouter) {
    routerVariant = 'next-app-router';
  } else if (hasPagesRouter) {
    routerVariant = 'next-pages-router';
  } else if (
    hasAnyFile(projectPath, ['src/routes/+page.svelte', 'src/routes/+layout.svelte', 'routes/+page.svelte']) ||
    deps['@sveltejs/kit']
  ) {
    routerVariant = 'sveltekit';
  } else if (deps['vue-router'] || hasAnyFile(projectPath, ['src/router/index.ts', 'src/router/index.js'])) {
    routerVariant = 'vue-router';
  } else if (deps['react-router-dom'] || deps['react-router'] || deps['@remix-run/react']) {
    routerVariant = 'react-router';
  } else if (deps['@angular/router']) {
    routerVariant = 'angular-router';
  }

  const extensionCounts = scanCharacteristicExtensions(projectPath);

  return {
    routerVariant,
    bundler,
    existingConfigFiles,
    extensionCounts,
  };
}
