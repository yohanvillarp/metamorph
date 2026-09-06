import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  noExternal: ['@nikelyh/application', '@nikelyh/infrastructure', '@nikelyh/domain'],
  external: ['node:sqlite', 'node:fs', 'node:path', 'child_process'],
  platform: 'node',
  target: 'node22',
  clean: true,
  async onSuccess() {
    const fs = await import('node:fs');
    const path = await import('node:path');
    
    // Fix esbuild stripping node: prefix from node:sqlite
    const distIndex = path.resolve(__dirname, 'dist/index.js');
    if (fs.existsSync(distIndex)) {
      let content = fs.readFileSync(distIndex, 'utf-8');
      content = content.replace(/from "sqlite"/g, 'from "node:sqlite"');
      fs.writeFileSync(distIndex, content, 'utf-8');
    }

    // Copy apps/dashboard/dist to dist/public so it's packaged with the CLI
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
