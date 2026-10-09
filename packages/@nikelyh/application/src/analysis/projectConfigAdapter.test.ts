import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  adaptTypeScriptConfig,
  ensureBuildScript,
  sanitizeJsonContent,
  detectEntryPoint,
  adaptProjectScripts,
} from './projectConfigAdapter';

describe('projectConfigAdapter', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metamorph-config-adapter-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('sanitizeJsonContent', () => {
    it('strips single-line and multi-line comments and trailing commas', () => {
      const raw = `
        {
          // A single line comment
          "name": "test", /* inline comment */
          "compilerOptions": {
            "target": "es2020",
          },
        }
      `;
      const sanitized = sanitizeJsonContent(raw);
      const parsed = JSON.parse(sanitized);
      assert.strictEqual(parsed.name, 'test');
      assert.strictEqual(parsed.compilerOptions.target, 'es2020');
    });
  });

  describe('adaptTypeScriptConfig', () => {
    it('injects experimentalDecorators, emitDecoratorMetadata, and types for nestjs', () => {
      const tsConfigPath = path.join(tmpDir, 'tsconfig.json');
      fs.writeFileSync(
        tsConfigPath,
        JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'CommonJS',
          },
        }, null, 2)
      );

      const res = adaptTypeScriptConfig(tmpDir, 'nestjs');
      assert.strictEqual(res.modified, true);
      assert.strictEqual(res.created, false);

      const updated = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));
      assert.strictEqual(updated.compilerOptions.experimentalDecorators, true);
      assert.strictEqual(updated.compilerOptions.emitDecoratorMetadata, true);
      assert.deepStrictEqual(updated.compilerOptions.types, ['node']);
      assert.strictEqual(updated.compilerOptions.target, 'ES2022');
    });

    it('handles tsconfig with comments and appends node to existing types array', () => {
      const tsConfigPath = path.join(tmpDir, 'tsconfig.json');
      fs.writeFileSync(
        tsConfigPath,
        `{
          // Custom tsconfig
          "compilerOptions": {
            "types": ["jest"],
          },
        }`
      );

      const res = adaptTypeScriptConfig(tmpDir, 'nestjs');
      assert.strictEqual(res.modified, true);

      const updated = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));
      assert.deepStrictEqual(updated.compilerOptions.types, ['jest', 'node']);
      assert.strictEqual(updated.compilerOptions.experimentalDecorators, true);
    });

    it('scaffolds a default tsconfig.json if none exists for nestjs target', () => {
      const tsConfigPath = path.join(tmpDir, 'tsconfig.json');
      assert.strictEqual(fs.existsSync(tsConfigPath), false);

      const res = adaptTypeScriptConfig(tmpDir, 'nestjs');
      assert.strictEqual(res.created, true);
      assert.strictEqual(res.modified, true);
      assert.strictEqual(fs.existsSync(tsConfigPath), true);

      const created = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));
      assert.strictEqual(created.compilerOptions.experimentalDecorators, true);
      assert.strictEqual(created.compilerOptions.emitDecoratorMetadata, true);
    });

    it('does nothing when target framework does not require special compilerOptions', () => {
      const tsConfigPath = path.join(tmpDir, 'tsconfig.json');
      const original = { compilerOptions: { target: 'ES2020' } };
      fs.writeFileSync(tsConfigPath, JSON.stringify(original, null, 2));

      const res = adaptTypeScriptConfig(tmpDir, 'express');
      assert.strictEqual(res.modified, false);
      assert.strictEqual(res.created, false);

      const current = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));
      assert.strictEqual(current.compilerOptions.experimentalDecorators, undefined);
    });
  });

  describe('ensureBuildScript', () => {
    it('aliases build:ts to build when build is absent', () => {
      const pkg: { scripts: Record<string, string> } = { scripts: { 'build:ts': 'tsc -p .' } };
      const modified = ensureBuildScript(pkg, 'nestjs');
      assert.strictEqual(modified, true);
      assert.strictEqual(pkg.scripts.build, 'npm run build:ts');
    });

    it('aliases compile to build when build is absent', () => {
      const pkg: { scripts: Record<string, string> } = { scripts: { 'compile': 'tsc' } };
      const modified = ensureBuildScript(pkg, 'nestjs');
      assert.strictEqual(modified, true);
      assert.strictEqual(pkg.scripts.build, 'npm run compile');
    });

    it('defaults to tsc for backend targets when no build script exists', () => {
      const pkg: { scripts?: Record<string, string> } = { scripts: {} };
      const modified = ensureBuildScript(pkg, 'nestjs');
      assert.strictEqual(modified, true);
      assert.strictEqual(pkg.scripts?.build, 'tsc');
    });

    it('preserves existing build script unchanged', () => {
      const pkg = { scripts: { build: 'nest build' } };
      const modified = ensureBuildScript(pkg, 'nestjs');
      assert.strictEqual(modified, false);
      assert.strictEqual(pkg.scripts.build, 'nest build');
    });
  });

  describe('detectEntryPoint', () => {
    it('detects src/app.ts when present', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src', 'app.ts'), '// app');
      const entry = detectEntryPoint(tmpDir);
      assert.strictEqual(entry.relativePath, 'src/app.ts');
      assert.strictEqual(entry.baseName, 'app');
      assert.strictEqual(entry.outPath, 'dist/app.js');
    });

    it('detects src/main.ts when present', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src', 'main.ts'), '// main');
      const entry = detectEntryPoint(tmpDir);
      assert.strictEqual(entry.relativePath, 'src/main.ts');
      assert.strictEqual(entry.baseName, 'main');
      assert.strictEqual(entry.outPath, 'dist/main.js');
    });

    it('detects root server.ts when src directory is not used', () => {
      fs.writeFileSync(path.join(tmpDir, 'server.ts'), '// server');
      const entry = detectEntryPoint(tmpDir);
      assert.strictEqual(entry.relativePath, 'server.ts');
      assert.strictEqual(entry.baseName, 'server');
      assert.strictEqual(entry.outPath, 'dist/server.js');
    });

    it('falls back to src/main.ts default when no candidate file is found', () => {
      const entry = detectEntryPoint(tmpDir);
      assert.strictEqual(entry.relativePath, 'src/main.ts');
      assert.strictEqual(entry.baseName, 'main');
      assert.strictEqual(entry.outPath, 'dist/main.js');
    });
  });

  describe('adaptProjectScripts', () => {
    it('dynamically points start script to dist/app.js when src/app.ts is present', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src', 'app.ts'), '// app');

      const pkg: { scripts: Record<string, string> } = {
        scripts: {
          start: 'fastify start -l info dist/app.js',
          dev: 'concurrently -k -p "[{name}]" -n "TypeScript,App" -c "yellow.bold,cyan.bold" "npm:watch:ts" "npm:dev:start"',
        },
      };

      const modified = adaptProjectScripts(pkg, tmpDir, 'nestjs');
      assert.strictEqual(modified, true);
      assert.strictEqual(pkg.scripts.build, 'tsc');
      assert.strictEqual(pkg.scripts.start, 'node dist/app.js');
      assert.strictEqual(pkg.scripts.dev, 'tsc -w');
    });

    it('points start script to dist/main.js when src/main.ts is present', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src', 'main.ts'), '// main');

      const pkg: { scripts: Record<string, string> } = { scripts: {} };
      const modified = adaptProjectScripts(pkg, tmpDir, 'nestjs');
      assert.strictEqual(modified, true);
      assert.strictEqual(pkg.scripts.build, 'tsc');
      assert.strictEqual(pkg.scripts.start, 'node dist/main.js');
      assert.strictEqual(pkg.scripts.dev, 'tsc -w');
    });

    it('preserves custom user build script while adapting start and dev', () => {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'src', 'app.ts'), '// app');

      const pkg: { scripts: Record<string, string> } = {
        scripts: {
          build: 'custom-build-tool',
        },
      };

      const modified = adaptProjectScripts(pkg, tmpDir, 'nestjs');
      assert.strictEqual(modified, true);
      assert.strictEqual(pkg.scripts.build, 'custom-build-tool');
      assert.strictEqual(pkg.scripts.start, 'node dist/app.js');
      assert.strictEqual(pkg.scripts.dev, 'tsc -w');
    });
  });
});
