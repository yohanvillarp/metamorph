import * as fs from 'fs';
import * as path from 'path';

export interface TsConfigAdapterResult {
  modified: boolean;
  created: boolean;
}

export interface EntryPointInfo {
  relativePath: string;
  baseName: string;
  outPath: string;
}

const CANDIDATE_ENTRIES = [
  'src/main.ts',
  'src/app.ts',
  'src/server.ts',
  'src/index.ts',
  'main.ts',
  'app.ts',
  'server.ts',
  'index.ts',
  'src/main.js',
  'src/app.js',
  'src/server.js',
  'src/index.js',
  'main.js',
  'app.js',
  'server.js',
  'index.js',
];

/**
 * Detects the real entry point of the project by checking common entry candidate paths on disk.
 */
export function detectEntryPoint(shadowDir: string): EntryPointInfo {
  for (const rel of CANDIDATE_ENTRIES) {
    const full = path.join(shadowDir, rel);
    try {
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        const baseName = path.basename(rel, path.extname(rel));
        return {
          relativePath: rel,
          baseName,
          outPath: `dist/${baseName}.js`,
        };
      }
    } catch {
      // ignore read/stat errors
    }
  }

  // Safe fallback default
  return {
    relativePath: 'src/main.ts',
    baseName: 'main',
    outPath: 'dist/main.js',
  };
}

/**
 * Safely strips comments and trailing commas from JSON strings (such as tsconfig.json).
 */
export function sanitizeJsonContent(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*/g, '$1')
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

/**
 * Ensures compilerOptions required by the target framework are configured in tsconfig.json.
 * For NestJS, enables experimentalDecorators, emitDecoratorMetadata, and node types.
 */
export function adaptTypeScriptConfig(
  shadowDir: string,
  targetFramework: string,
): TsConfigAdapterResult {
  const tsConfigPath = path.join(shadowDir, 'tsconfig.json');
  const target = targetFramework.toLowerCase();

  // If tsconfig does not exist and target requires TypeScript configuration
  if (!fs.existsSync(tsConfigPath)) {
    if (target === 'nestjs') {
      const defaultNestTsConfig = {
        compilerOptions: {
          module: 'commonjs',
          declaration: true,
          removeComments: true,
          emitDecoratorMetadata: true,
          experimentalDecorators: true,
          allowSyntheticDefaultImports: true,
          target: 'ES2021',
          sourceMap: true,
          outDir: './dist',
          baseUrl: './',
          incremental: true,
          skipLibCheck: true,
          strictNullChecks: false,
          noImplicitAny: false,
          types: ['node'],
        },
        include: ['src/**/*'],
      };
      fs.writeFileSync(tsConfigPath, JSON.stringify(defaultNestTsConfig, null, 2) + '\n', 'utf-8');
      return { modified: true, created: true };
    }
    return { modified: false, created: false };
  }

  try {
    const rawContent = fs.readFileSync(tsConfigPath, 'utf-8');
    const sanitized = sanitizeJsonContent(rawContent);
    const tsconfig = JSON.parse(sanitized);

    let modified = false;

    if (!tsconfig.compilerOptions) {
      tsconfig.compilerOptions = {};
      modified = true;
    }

    if (target === 'nestjs') {
      if (tsconfig.compilerOptions.experimentalDecorators !== true) {
        tsconfig.compilerOptions.experimentalDecorators = true;
        modified = true;
      }
      if (tsconfig.compilerOptions.emitDecoratorMetadata !== true) {
        tsconfig.compilerOptions.emitDecoratorMetadata = true;
        modified = true;
      }
      if (!tsconfig.compilerOptions.types) {
        tsconfig.compilerOptions.types = ['node'];
        modified = true;
      } else if (Array.isArray(tsconfig.compilerOptions.types) && !tsconfig.compilerOptions.types.includes('node')) {
        tsconfig.compilerOptions.types.push('node');
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(tsConfigPath, JSON.stringify(tsconfig, null, 2) + '\n', 'utf-8');
    }

    return { modified, created: false };
  } catch (err) {
    console.warn('[projectConfigAdapter] Warning: Could not parse or adapt tsconfig.json:', err);
    return { modified: false, created: false };
  }
}

/**
 * Backwards-compatible build script assurer.
 */
export function ensureBuildScript(
  pkg: { scripts?: Record<string, string> },
  targetFramework: string,
): boolean {
  if (!pkg.scripts) {
    pkg.scripts = {};
  }

  if (pkg.scripts.build && pkg.scripts.build.trim().length > 0) {
    return false;
  }

  if (pkg.scripts['build:ts']) {
    pkg.scripts.build = 'npm run build:ts';
    return true;
  }

  if (pkg.scripts.compile) {
    pkg.scripts.build = 'npm run compile';
    return true;
  }

  const target = targetFramework.toLowerCase();
  if (['nestjs', 'express', 'fastify'].includes(target)) {
    pkg.scripts.build = 'tsc';
    return true;
  }

  return false;
}

/**
 * Adapt package.json scripts to ensure valid build, start, and dev commands
 * for the target framework, dynamically binding to the actual entry point on disk.
 */
export function adaptProjectScripts(
  pkg: { scripts?: Record<string, string> },
  shadowDir: string,
  targetFramework: string,
): boolean {
  if (!pkg.scripts) {
    pkg.scripts = {};
  }

  let modified = false;
  const target = targetFramework.toLowerCase();
  const entry = detectEntryPoint(shadowDir);

  // 1. Ensure 'build' script
  if (!pkg.scripts.build || pkg.scripts.build.trim().length === 0) {
    if (pkg.scripts['build:ts']) {
      pkg.scripts.build = 'npm run build:ts';
      modified = true;
    } else if (pkg.scripts.compile) {
      pkg.scripts.build = 'npm run compile';
      modified = true;
    } else if (['nestjs', 'express', 'fastify'].includes(target)) {
      pkg.scripts.build = 'tsc';
      modified = true;
    }
  }

  // 2. Ensure 'start' script targets the real compiled entry point
  if (['nestjs', 'express', 'fastify'].includes(target)) {
    const currentStart = pkg.scripts.start || '';
    if (!pkg.scripts.start || /fastify start|nest start|dist\/(main|app|server|index)\.js/.test(currentStart)) {
      const targetStart = `node ${entry.outPath}`;
      if (pkg.scripts.start !== targetStart) {
        pkg.scripts.start = targetStart;
        modified = true;
      }
    }
  }

  // 3. Clean and adapt 'dev' script
  if (target === 'nestjs') {
    const currentDev = pkg.scripts.dev || '';
    if (/watch:ts|dev:start|fastify/.test(currentDev)) {
      pkg.scripts.dev = 'tsc -w';
      modified = true;
    } else if (!pkg.scripts.dev) {
      pkg.scripts.dev = 'tsc -w';
      modified = true;
    }
  }

  return modified;
}
