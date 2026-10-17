import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('CLI Contract & Build Integrity', () => {
  const cliDir = path.resolve(import.meta.dirname, '..');
  const pkgPath = path.join(cliDir, 'package.json');
  const indexPath = path.join(cliDir, 'src/index.ts');
  const distDir = path.join(cliDir, 'dist');

  test('version in src/index.ts matches package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    const match = indexContent.match(/\.version\(['"]([^'"]+)['"]\)/);
    assert.ok(match, 'Expected to find .version(...) in src/index.ts');
    assert.equal(match[1], pkg.version, `CLI version (${match[1]}) must match package.json version (${pkg.version})`);
  });

  test('no unprefixed sqlite imports exist in built dist files', () => {
    if (!fs.existsSync(distDir)) {
      // If dist has not been built yet, skip gracefully
      return;
    }

    const files = fs.readdirSync(distDir).filter((f) => f.endsWith('.js'));
    assert.ok(files.length > 0, 'Expected dist to contain .js bundle files');

    for (const file of files) {
      const filePath = path.join(distDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      const unprefixedFrom = /from\s+["']sqlite["']/.test(content);
      const unprefixedImport = /import\s*\(\s*["']sqlite["']\s*\)/.test(content);

      assert.equal(
        unprefixedFrom || unprefixedImport,
        false,
        `File ${file} contains illegal unprefixed "sqlite" import! Must use "node:sqlite".`
      );
    }
  });

  test('dashboard UI is bundled in dist/public if dist exists', () => {
    if (!fs.existsSync(distDir)) return;
    const publicDir = path.join(distDir, 'public');
    const indexHtml = path.join(publicDir, 'index.html');
    assert.ok(fs.existsSync(publicDir), 'Expected dist/public to exist in CLI build');
    assert.ok(fs.existsSync(indexHtml), 'Expected dist/public/index.html to exist');
  });

  test('src/index.ts registers config command and run command options', () => {
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    assert.ok(indexContent.includes('registerConfigCommand(program)'), 'Expected registerConfigCommand to be called');
    assert.ok(indexContent.includes('registerRunCommand(program)'), 'Expected registerRunCommand to be called');

    const runOptionsPath = path.join(cliDir, 'src/commands/run/run.options.ts');
    const runOptionsContent = fs.readFileSync(runOptionsPath, 'utf-8');
    assert.ok(runOptionsContent.includes('--model <model>'), 'Expected --model option in run command');
    assert.ok(runOptionsContent.includes('--concurrency <number>'), 'Expected --concurrency option in run command');
    assert.ok(runOptionsContent.includes('--timeout <seconds>'), 'Expected --timeout option in run command');
    assert.ok(runOptionsContent.includes('--retries <number>'), 'Expected --retries option in run command');
    assert.ok(runOptionsContent.includes('--mock'), 'Expected --mock option in run command');
  });

  test('--mock flag and credentials bypass work seamlessly', async () => {
    const runOptionsPath = path.join(cliDir, 'src/commands/run/run.options.ts');
    const runOptionsContent = fs.readFileSync(runOptionsPath, 'utf-8');
    assert.ok(runOptionsContent.includes('--mock'), 'Expected --mock in run.options.ts');
    assert.ok(runOptionsContent.includes('mock?: boolean'), 'Expected mock?: boolean in RunCommandOptions');

    const presenterPath = path.join(cliDir, 'src/commands/run/run.presenter.ts');
    const { hasLlmCredentials, presentMockNotice } = await import('./commands/run/run.presenter.js');
    assert.ok(typeof presentMockNotice === 'function', 'Expected presentMockNotice in presenter');

    // With zero env credentials, mock config still returns true
    const savedOpenAi = process.env.OPENAI_API_KEY;
    const savedAnthropic = process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      assert.equal(hasLlmCredentials({ model: 'mock', concurrency: 3, inferenceTimeoutMs: 120000, maxRetries: 2, maxIntegrationRounds: 4, disabledAgents: [] }), true);
      assert.equal(hasLlmCredentials({ model: 'gpt-5.4', mock: true, concurrency: 3, inferenceTimeoutMs: 120000, maxRetries: 2, maxIntegrationRounds: 4, disabledAgents: [] }), true);

      process.env.METAMORPH_MOCK = '1';
      assert.equal(hasLlmCredentials(), true);
      delete process.env.METAMORPH_MOCK;

      assert.equal(hasLlmCredentials({ model: 'gpt-5.4', concurrency: 3, inferenceTimeoutMs: 120000, maxRetries: 2, maxIntegrationRounds: 4, disabledAgents: [] }), false);
    } finally {
      if (savedOpenAi) process.env.OPENAI_API_KEY = savedOpenAi;
      if (savedAnthropic) process.env.ANTHROPIC_API_KEY = savedAnthropic;
    }
  });

  test('--dry-run flag is registered and presenter exists', () => {
    const runOptionsPath = path.join(cliDir, 'src/commands/run/run.options.ts');
    const runOptionsContent = fs.readFileSync(runOptionsPath, 'utf-8');
    assert.ok(runOptionsContent.includes('--dry-run'), 'Expected --dry-run option in run command');
    assert.ok(runOptionsContent.includes('dryRun'), 'Expected dryRun in RunCommandOptions interface');

    const presenterPath = path.join(cliDir, 'src/commands/run/run.presenter.ts');
    const presenterContent = fs.readFileSync(presenterPath, 'utf-8');
    assert.ok(presenterContent.includes('presentDryRun'), 'Expected presentDryRun function in presenter');

    const commandPath = path.join(cliDir, 'src/commands/run/run.command.ts');
    const commandContent = fs.readFileSync(commandPath, 'utf-8');
    assert.ok(commandContent.includes('options.dryRun'), 'Expected dry-run branch in executeRunAction');
    assert.ok(commandContent.includes('presentDryRun'), 'Expected presentDryRun call in command');
  });

  test('--dry-run guards against empty inspectProject result', () => {
    const commandPath = path.join(cliDir, 'src/commands/run/run.command.ts');
    const commandContent = fs.readFileSync(commandPath, 'utf-8');
    assert.ok(commandContent.includes('if (!profile)'), 'Expected guard for undefined profile in dry-run path');
  });

  test('SUPPORTED_MIGRATIONS is dynamically derived from @nikelyh/domain', async () => {
    const { SUPPORTED_MIGRATIONS } = await import('./commands/run/run.options.js');
    assert.ok(SUPPORTED_MIGRATIONS.express.includes('hono'));
    assert.ok(SUPPORTED_MIGRATIONS.hono.includes('fastify'));
    assert.ok(SUPPORTED_MIGRATIONS.react.includes('next'));
    assert.ok(SUPPORTED_MIGRATIONS.next.includes('react'));
  });
});

