import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { ConfigStore, CONFIG_FILE_NAME } from './ConfigStore';
import { DEFAULT_METAMORPH_CONFIG } from '@nikelyh/domain';

describe('ConfigStore Cascading Precedence', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `metamorph-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  test('resolves default configuration when no overrides are present', () => {
    const config = ConfigStore.resolveConfig({
      cwd: tmpDir,
      env: {},
    });

    assert.equal(config.model, DEFAULT_METAMORPH_CONFIG.model);
    assert.equal(config.concurrency, DEFAULT_METAMORPH_CONFIG.concurrency);
    assert.equal(config.inferenceTimeoutMs, DEFAULT_METAMORPH_CONFIG.inferenceTimeoutMs);
    assert.equal(config.maxRetries, DEFAULT_METAMORPH_CONFIG.maxRetries);
    assert.equal(config.maxIntegrationRounds, DEFAULT_METAMORPH_CONFIG.maxIntegrationRounds);
  });

  test('loads local config file overrides', () => {
    const localConfigFile = path.join(tmpDir, CONFIG_FILE_NAME);
    fs.writeFileSync(localConfigFile, JSON.stringify({
      model: 'claude-3-7-sonnet',
      concurrency: 5,
    }), 'utf-8');

    const config = ConfigStore.resolveConfig({
      cwd: tmpDir,
      env: {},
    });

    assert.equal(config.model, 'claude-3-7-sonnet');
    assert.equal(config.concurrency, 5);
    assert.equal(config.inferenceTimeoutMs, DEFAULT_METAMORPH_CONFIG.inferenceTimeoutMs);
  });

  test('environment variables override local config file', () => {
    const localConfigFile = path.join(tmpDir, CONFIG_FILE_NAME);
    fs.writeFileSync(localConfigFile, JSON.stringify({
      model: 'claude-3-7-sonnet',
      concurrency: 5,
    }), 'utf-8');

    const config = ConfigStore.resolveConfig({
      cwd: tmpDir,
      env: {
        METAMORPH_MODEL: 'claude-sonnet-4-6',
        METAMORPH_CONCURRENCY: '8',
      },
    });

    assert.equal(config.model, 'claude-sonnet-4-6');
    assert.equal(config.concurrency, 8);
  });

  test('CLI flags have the highest precedence, overriding environment and config file', () => {
    const localConfigFile = path.join(tmpDir, CONFIG_FILE_NAME);
    fs.writeFileSync(localConfigFile, JSON.stringify({
      model: 'claude-3-7-sonnet',
      concurrency: 5,
    }), 'utf-8');

    const config = ConfigStore.resolveConfig({
      cwd: tmpDir,
      env: {
        METAMORPH_MODEL: 'claude-sonnet-4-6',
        METAMORPH_CONCURRENCY: '8',
      },
      cliFlags: {
        model: 'custom-fine-tuned-model',
        concurrency: 2,
      },
    });

    assert.equal(config.model, 'custom-fine-tuned-model');
    assert.equal(config.concurrency, 2);
  });

  test('saveLocalConfig and loadLocalConfig persist settings', () => {
    ConfigStore.saveLocalConfig({
      model: 'gpt-4o',
      maxRetries: 3,
    }, tmpDir);

    const loaded = ConfigStore.loadLocalConfig(tmpDir);
    assert.ok(loaded);
    assert.equal(loaded.model, 'gpt-4o');
    assert.equal(loaded.maxRetries, 3);
  });
});
