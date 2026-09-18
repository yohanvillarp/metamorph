import * as fs from 'fs';
import * as path from 'path';
import type { StructureIssue } from '../migration/types';

export function readIfExists(...candidates: string[]): { filePath: string; content: string } | null {
  for (const filePath of candidates) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return { filePath, content: fs.readFileSync(filePath, 'utf-8') };
    }
  }
  return null;
}

function leftoverScripts(shadowRoot: string, forbidden: RegExp, message: string): StructureIssue[] {
  const pkgPath = path.join(shadowRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return [];
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> };
    const hits = Object.entries(pkg.scripts || {}).filter(([, cmd]) => forbidden.test(cmd));
    if (hits.length === 0) return [];
    return [{
      filePath: pkgPath,
      errors: [`${message} (${hits.map(([name]) => name).join(', ')}).`],
    }];
  } catch {
    return [];
  }
}

function viteConfigUsesPlugin(shadowRoot: string, pluginNeedle: RegExp): StructureIssue[] {
  const file = readIfExists(
    path.join(shadowRoot, 'vite.config.ts'),
    path.join(shadowRoot, 'vite.config.js'),
  );
  if (!file) {
    return [{
      filePath: path.join(shadowRoot, 'vite.config.ts'),
      errors: ['Missing vite.config.ts for this Vite SPA target.'],
    }];
  }
  const issues: StructureIssue[] = [];
  if (!pluginNeedle.test(file.content)) {
    issues.push({
      filePath: file.filePath,
      errors: ['vite.config.ts does not register the plugin for the target framework.'],
    });
  }
  if (/__dirname/.test(file.content) && !/import\.meta\.dirname/.test(file.content)) {
    issues.push({
      filePath: file.filePath,
      errors: ['vite.config.ts uses __dirname in ESM. Replace it with import.meta.dirname.'],
    });
  }
  return issues;
}

function indexHtmlIssues(shadowRoot: string, mountId: string, scriptNeedle: RegExp): StructureIssue[] {
  const html = readIfExists(path.join(shadowRoot, 'index.html'));
  if (!html) {
    return [{
      filePath: path.join(shadowRoot, 'index.html'),
      errors: [`Missing Vite index.html. It must contain <div id="${mountId}"> and a module script to the SPA entry.`],
    }];
  }
  const issues: StructureIssue[] = [];
  if (!new RegExp(`id=["']${mountId}["']`).test(html.content)) {
    issues.push({
      filePath: html.filePath,
      errors: [`index.html must mount the app on #${mountId} (the entry's mount() / createApp / createRoot target).`],
    });
  }
  if (!scriptNeedle.test(html.content)) {
    issues.push({
      filePath: html.filePath,
      errors: ['index.html must load the SPA entry as <script type="module" src="/src/main.ts"> (or main.tsx).'],
    });
  }
  return issues;
}

function leftoverNextApp(shadowRoot: string): StructureIssue[] {
  const files = [
    path.join(shadowRoot, 'src', 'app', 'page.tsx'),
    path.join(shadowRoot, 'src', 'app', 'layout.tsx'),
    path.join(shadowRoot, 'app', 'page.tsx'),
    path.join(shadowRoot, 'app', 'layout.tsx'),
  ].filter((file) => fs.existsSync(file));
  return files.map((filePath) => ({
    filePath,
    errors: ['Leftover Next App Router file. Delete it after the target SPA/CLI boots so it cannot be mistaken for the new tree.'],
  }));
}

function leftoverViteWhenAngular(shadowRoot: string): StructureIssue[] {
  const issues: StructureIssue[] = [];
  for (const rel of ['vite.config.ts', 'vite.config.js', 'index.html']) {
    const filePath = path.join(shadowRoot, rel);
    if (fs.existsSync(filePath)) {
      issues.push({
        filePath,
        errors: [`Leftover Vite file ${rel}. Angular boots from src/main.ts + src/index.html + angular.json — delete the Vite entry.`],
      });
    }
  }
  return issues;
}

function isStubEntry(content: string): boolean {
  const hasLocalImport = /from\s+['"](\.\.?\/|@\/)/.test(content);
  const emptyHeading = /<h1[^>]*>[^<]{0,40}<\/h1>|TODO:|coming soon/i.test(content);
  return emptyHeading && !hasLocalImport;
}

export function analyzeVueTarget(shadowRoot: string): StructureIssue[] {
  const issues: StructureIssue[] = [
    ...indexHtmlIssues(shadowRoot, 'app', /src\/main\.(t|j)sx?/),
    ...viteConfigUsesPlugin(shadowRoot, /plugin-vue|@vitejs\/plugin-vue/),
    ...leftoverScripts(shadowRoot, /\b(next|ng)\b/, 'package.json still runs Next/Angular scripts; Vue target must use Vite'),
    ...leftoverNextApp(shadowRoot),
  ];
  const main = readIfExists(path.join(shadowRoot, 'src', 'main.ts'), path.join(shadowRoot, 'src', 'main.js'));
  if (!main) {
    issues.push({
      filePath: path.join(shadowRoot, 'src', 'main.ts'),
      errors: ['Missing src/main.ts. createApp(App).use(router).mount("#app") and import global CSS.'],
    });
  } else {
    if (!/createApp\(/.test(main.content) || !/mount\(/.test(main.content)) {
      issues.push({
        filePath: main.filePath,
        errors: ['Vue entry must createApp(...).mount("#app"). Do not leave ReactDOM.createRoot here.'],
      });
    }
    if (/createRoot|react-dom/.test(main.content)) {
      issues.push({
        filePath: main.filePath,
        errors: ['Vue entry still mounts React. Replace createRoot with createApp and delete ReactDOM.'],
      });
    }
    if (!/import\s+['"][^'"]+\.(?:css|scss|sass)['"]/.test(main.content)) {
      const css = path.join(shadowRoot, 'src', 'index.css');
      if (fs.existsSync(css)) {
        issues.push({
          filePath: main.filePath,
          errors: ['Global CSS exists but is not imported from src/main.ts. Vite will ship an unstyled app.'],
        });
      }
    }
    if (isStubEntry(main.content)) {
      issues.push({
        filePath: main.filePath,
        errors: ['Vue entry does not import the real App/router. Import existing screens; do not mount an empty shell.'],
      });
    }
  }
  return issues;
}

export function analyzeSvelteTarget(shadowRoot: string): StructureIssue[] {
  const issues: StructureIssue[] = [
    ...indexHtmlIssues(shadowRoot, 'app', /src\/main\.(t|j)sx?/),
    ...viteConfigUsesPlugin(shadowRoot, /vite-plugin-svelte|svelte\(/),
    ...leftoverScripts(shadowRoot, /\b(next|ng)\b/, 'package.json still runs Next/Angular scripts; Svelte target must use Vite'),
    ...leftoverNextApp(shadowRoot),
  ];
  const kit = path.join(shadowRoot, 'src', 'routes', '+page.svelte');
  if (fs.existsSync(kit)) {
    issues.push({
      filePath: kit,
      errors: ['SvelteKit +page.svelte appeared but this catalog targets a Vite SPA. Use App.svelte + mount() instead of Kit file routes.'],
    });
  }
  const main = readIfExists(path.join(shadowRoot, 'src', 'main.ts'), path.join(shadowRoot, 'src', 'main.js'));
  if (!main) {
    issues.push({
      filePath: path.join(shadowRoot, 'src', 'main.ts'),
      errors: ['Missing src/main.ts. Use mount(App, { target: document.getElementById("app") }) and import global CSS.'],
    });
  } else if (!/from\s+['"]svelte['"]/.test(main.content) && !/new\s+\w+\(\s*\{\s*target/.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: ['Svelte entry must mount the root .svelte component onto #app.'],
    });
  }
  return issues;
}

export function analyzeAngularTarget(shadowRoot: string): StructureIssue[] {
  const issues: StructureIssue[] = [
    ...leftoverViteWhenAngular(shadowRoot),
    ...leftoverScripts(shadowRoot, /\b(vite|next)\b/, 'package.json still runs Vite/Next; Angular target must use ng serve / ng build'),
  ];
  const angularJson = path.join(shadowRoot, 'angular.json');
  if (!fs.existsSync(angularJson)) {
    issues.push({
      filePath: angularJson,
      errors: ['Missing angular.json. ng build will not run. Scaffold it and point browser to src/main.ts and styles to src/styles.css.'],
    });
  }
  const main = readIfExists(path.join(shadowRoot, 'src', 'main.ts'));
  if (!main || !/bootstrapApplication\(/.test(main.content || '')) {
    issues.push({
      filePath: path.join(shadowRoot, 'src', 'main.ts'),
      errors: ['Missing bootstrapApplication in src/main.ts. Angular standalone boots here, not from a Vite main.tsx.'],
    });
  }
  const routes = readIfExists(path.join(shadowRoot, 'src', 'app', 'app.routes.ts'));
  if (routes && /export const routes: Routes = \[\s*\]/.test(routes.content)) {
    issues.push({
      filePath: routes.filePath,
      errors: ['app.routes.ts has no routes. Map each source URL to the existing feature component. App stays a <router-outlet /> shell.'],
    });
  }
  const html = readIfExists(path.join(shadowRoot, 'src', 'index.html'));
  if (!html) {
    issues.push({
      filePath: path.join(shadowRoot, 'src', 'index.html'),
      errors: ['Missing src/index.html with <app-root></app-root>.'],
    });
  }
  return issues;
}

export function vueFileHint(filePath: string, target: string): string {
  if (target !== 'vue') return '';
  const normalized = filePath.replace(/\\/g, '/');
  if (/\/main\.(t|j)sx?$/.test(normalized)) {
    return `
This is the Vue entry. It must createApp(App).use(router).mount("#app") and import global CSS.
index.html uses #app, not #root. Do not leave createRoot/ReactDOM.
`;
  }
  if (/\.(t|j)sx$/.test(normalized) && !/vite\.config/.test(normalized)) {
    return `
Convert this UI file into a .vue SFC (<script setup> + template + style). Keep prop and emit names. Then delete this leftover TSX once the SFC exists.
`;
  }
  return '';
}

export function svelteFileHint(filePath: string, target: string): string {
  if (target !== 'svelte') return '';
  const normalized = filePath.replace(/\\/g, '/');
  if (/\/main\.(t|j)sx?$/.test(normalized)) {
    return `
This is the Svelte entry. mount(App, { target: document.getElementById("app") }). Do not create SvelteKit +page.svelte routes.
`;
  }
  return '';
}

export function angularFileHint(filePath: string, target: string): string {
  if (target !== 'angular') return '';
  const normalized = filePath.replace(/\\/g, '/');
  if (/app\.routes\.ts$/.test(normalized)) {
    return `
Map each source route to an existing feature component. Do not inline that component's template. App is <router-outlet />.
Keep @Input / @Output names when the host binds them.
`;
  }
  if (/\/main\.(t|j)sx$/.test(normalized)) {
    return `
Vite/React main.tsx is not the Angular entry. Angular boots from src/main.ts via bootstrapApplication. Delete this file after src/main.ts exists.
`;
  }
  return '';
}
