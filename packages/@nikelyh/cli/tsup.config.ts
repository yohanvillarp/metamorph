import { defineConfig } from 'tsup';
import type { Plugin } from 'esbuild';

/**
 * esbuild strips the `node:` prefix, so `node:sqlite` becomes `sqlite`.
 * Node has no `sqlite` package — only `node:sqlite` — which breaks the published CLI.
 */
const keepNodeSqlite: Plugin = {
  name: 'keep-node-sqlite',
  setup(build) {
    build.onResolve({ filter: /^(node:)?sqlite$/ }, () => ({
      path: 'node:sqlite',
      external: true,
    }));
  },
};

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  noExternal: ['@nikelyh/application', '@nikelyh/infrastructure', '@nikelyh/domain'],
  external: ['node:sqlite', 'node:fs', 'node:path', 'child_process'],
  platform: 'node',
  target: 'node22',
  clean: true,
  esbuildPlugins: [keepNodeSqlite],
  async onSuccess() {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      for (const file of fs.readdirSync(distDir)) {
        if (!file.endsWith('.js')) continue;
        const filePath = path.join(distDir, file);
        let content = fs.readFileSync(filePath, 'utf-8');
        const patched = content
          .replace(/from ["']sqlite["']/g, 'from "node:sqlite"')
          .replace(/import\(["']sqlite["']\)/g, 'import("node:sqlite")');
        if (patched !== content) {
          fs.writeFileSync(filePath, patched, 'utf-8');
        }
      }
    }

    const src = path.resolve(__dirname, '../../../apps/dashboard/dist');
    const dest = path.resolve(__dirname, 'dist/public');
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true });
      console.log('✅ Dashboard UI copied to CLI dist/public');
    } else {
      console.log('⚠️ Dashboard UI dist not found. Run build in apps/dashboard first.');
    }
  }
});
