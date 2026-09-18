export const VITE_SPA_SCRIPTS = {
  dev: 'vite',
  build: 'vite build',
  preview: 'vite preview',
  start: 'vite preview',
};

export const NEXT_SCRIPTS = {
  dev: 'next dev',
  build: 'next build',
  start: 'next start',
  lint: 'next lint',
};

export const ANGULAR_SCRIPTS = {
  dev: 'ng serve',
  build: 'ng build',
  start: 'ng serve',
};

export const REACT_VITE_SCAFFOLDS: Record<string, string> = {
  'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
`,
};

export const VUE_SCAFFOLDS: Record<string, string> = {
  'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
  'vite.config.ts': `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
`,
  'src/vite-env.d.ts': `/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
`,
};

export const SVELTE_SCAFFOLDS: Record<string, string> = {
  'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
  'vite.config.ts': `import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
`,
  'svelte.config.js': `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
};
`,
  'src/vite-env.d.ts': `/// <reference types="svelte" />
/// <reference types="vite/client" />
`,
};

export const ANGULAR_SCAFFOLDS: Record<string, string> = {
  'angular.json': `{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "app": {
      "projectType": "application",
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:application",
          "options": {
            "outputPath": "dist/app",
            "index": "src/index.html",
            "browser": "src/main.ts",
            "tsConfig": "tsconfig.app.json",
            "assets": [{ "glob": "**/*", "input": "public" }],
            "styles": ["src/styles.css"]
          },
          "configurations": {
            "production": { "outputHashing": "all" },
            "development": { "optimization": false, "sourceMap": true }
          },
          "defaultConfiguration": "production"
        },
        "serve": {
          "builder": "@angular-devkit/build-angular:dev-server",
          "configurations": {
            "production": { "buildTarget": "app:build:production" },
            "development": { "buildTarget": "app:build:development" }
          },
          "defaultConfiguration": "development"
        }
      }
    }
  }
}
`,
  'tsconfig.app.json': `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/app",
    "types": []
  },
  "files": ["src/main.ts"],
  "include": ["src/**/*.d.ts", "src/**/*.ts"]
}
`,
  'src/index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>App</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
`,
  'src/main.ts': `import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
`,
  'src/app/app.config.ts': `import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes)],
};
`,
  'src/app/app.routes.ts': `import { Routes } from '@angular/router';

/** Worker: map each source URL to the existing feature component. Do not inline that component's template here. */
export const routes: Routes = [];
`,
  'src/app/app.ts': `import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {}
`,
  'src/styles.css': `/* Global styles — Worker should import/copy the source global stylesheet here. */
`,
};

export const NEXT_SCAFFOLDS: Record<string, string> = {
  'next.config.ts': `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`,
  'src/app/layout.tsx': `import type { ReactNode } from 'react';
import '../index.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
};

export const VITE_FILES_TO_DELETE = ['vite.config.ts', 'vite.config.js'];
export const NEXT_FILES_TO_DELETE = ['next.config.js', 'next.config.mjs', 'next.config.ts', 'next-env.d.ts'];
export const ANGULAR_FILES_TO_DELETE = ['angular.json'];
export const VUE_FILES_TO_DELETE = ['vue.config.js'];
export const SVELTE_FILES_TO_DELETE = ['svelte.config.js', 'svelte.config.ts'];
