import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  noExternal: ['@nikelyh/application', '@nikelyh/infrastructure', '@nikelyh/domain'],
  external: ['node:sqlite', 'node:fs', 'node:path'],
  platform: 'node',
  clean: true,
});
