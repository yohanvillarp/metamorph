#!/usr/bin/env node

// For development, we use tsx to run the typescript file directly.
import { spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const indexPath = resolve(__dirname, '../src/index.ts');

const result = spawnSync('npx', ['tsx', indexPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true
});

process.exit(result.status || 0);
