import * as fs from 'fs';
import * as path from 'path';
import type { MigrationPlugin, StructureIssue } from '../types';

function readIfExists(...candidates: string[]): { filePath: string; content: string } | null {
  for (const filePath of candidates) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return { filePath, content: fs.readFileSync(filePath, 'utf-8') };
    }
  }
  return null;
}

function listCssFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /\.(css|scss|sass)$/i.test(name))
    .map((name) => path.join(dir, name));
}

/**
 * Next layout often owns the only global CSS import. After moving to Vite, main.tsx
 * must re-attach that CSS or the SPA renders with browser defaults.
 */
function hasLocalComponentImport(content: string): boolean {
  return /import\s+(?:type\s+)?(?:[\w*{}\s,]+)\s+from\s+['"](\.\.?\/|@\/)(?!.*\.(?:css|scss|sass)['"])/i.test(content)
    || /import\s+['"](\.\.?\/|@\/)[^'"]+\.(t|j)sx['"]/.test(content);
}

export function isStubSpaEntry(content: string): boolean {
  const emptyMount = /<div\s+id=["']app["']\s*\/>|<div\s*\/>\s*[;)]|return\s+null\s*;?|return\s*\(\s*<>\s*<\/>\s*\)/i.test(content);
  const hasRouter = /BrowserRouter|RouterProvider|createBrowserRouter|HashRouter/i.test(content);
  if (hasRouter && hasLocalComponentImport(content)) return false;
  if (emptyMount) return true;
  if (!hasLocalComponentImport(content) && /createRoot\(/.test(content)) return true;
  return false;
}

function listTsxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.(t|j)sx$/.test(entry.name) && !entry.name.endsWith('.obsolete')) out.push(full);
    }
  }
  return out;
}

function leftoverNextAppFiles(shadowRoot: string): string[] {
  const dirs = [path.join(shadowRoot, 'src', 'app'), path.join(shadowRoot, 'app')];
  const found: string[] = [];
  for (const dir of dirs) {
    for (const file of listTsxFiles(dir)) {
      const base = path.basename(file);
      if (/^(page|layout|template|loading|error|not-found)\.(t|j)sx$/.test(base)) {
        found.push(file);
      }
    }
  }
  return found;
}

function findUnmountedScreens(shadowRoot: string, entryContent: string): string[] {
  const candidates = [
    path.join(shadowRoot, 'src', 'App.tsx'),
    path.join(shadowRoot, 'src', 'App.jsx'),
    path.join(shadowRoot, 'src', 'routes', 'AppRoutes.tsx'),
    path.join(shadowRoot, 'src', 'routes', 'AppRoutes.jsx'),
  ];
  const unused: string[] = [];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const stem = path.basename(file).replace(/\.(t|j)sx$/, '');
    if (!entryContent.includes(stem)) unused.push(file);
  }
  return unused;
}

export function analyzeNextToReactBootstrap(shadowRoot: string): StructureIssue[] {
  const issues: StructureIssue[] = [];
  const main = readIfExists(
    path.join(shadowRoot, 'src', 'main.tsx'),
    path.join(shadowRoot, 'src', 'main.jsx'),
    path.join(shadowRoot, 'src', 'index.tsx'),
  );
  if (!main) {
    issues.push({
      filePath: path.join(shadowRoot, 'src', 'main.tsx'),
      errors: [
        'Missing SPA entry. Create src/main.tsx that mounts BrowserRouter and the former home screen into #root. Vite can start with a blank page if this file only renders an empty div.',
      ],
    });
    return issues;
  }

  if (isStubSpaEntry(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: [
        'src/main.tsx does not mount the application UI. Import the router and the former home screen. Do not render only an empty element, null, or a placeholder — that is a blank page even when npm run dev succeeds.',
      ],
    });
  } else if (!/BrowserRouter|RouterProvider|createBrowserRouter|HashRouter/i.test(main.content)) {
    issues.push({
      filePath: main.filePath,
      errors: [
        'SPA entry has no React Router. Wrap the tree in <BrowserRouter> (or RouterProvider) so former Next routes still have URLs.',
      ],
    });
  }

  const unused = findUnmountedScreens(shadowRoot, main.content);
  for (const file of unused) {
    issues.push({
      filePath: file,
      errors: [
        `${path.relative(shadowRoot, file)} exists but is not imported from the SPA entry. Wire it from src/main.tsx or it will never render.`,
      ],
    });
  }

  for (const file of leftoverNextAppFiles(shadowRoot)) {
    issues.push({
      filePath: file,
      errors: [
        'Leftover Next App Router file. After the Vite SPA boots, delete src/app/page.tsx and layout.tsx (or they confuse the next run).',
      ],
    });
  }

  const pkgPath = path.join(shadowRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> };
      const nextScripts = Object.entries(pkg.scripts || {}).filter(([, cmd]) => /\bnext\b/.test(cmd));
      if (nextScripts.length > 0) {
        issues.push({
          filePath: pkgPath,
          errors: [
            `package.json still runs Next in scripts (${nextScripts.map(([name]) => name).join(', ')}). Replace them with Vite/eslint equivalents (dev/build/preview/start/lint).`,
          ],
        });
      }
    } catch {
      // ignore malformed json
    }
  }

  return issues;
}

export function analyzeNextToReactStyles(shadowRoot: string): StructureIssue[] {
  const issues: StructureIssue[] = [];
  const main = readIfExists(
    path.join(shadowRoot, 'src', 'main.tsx'),
    path.join(shadowRoot, 'src', 'main.jsx'),
    path.join(shadowRoot, 'src', 'main.ts'),
    path.join(shadowRoot, 'src', 'index.tsx'),
  );

  const layout = readIfExists(
    path.join(shadowRoot, 'src', 'app', 'layout.tsx'),
    path.join(shadowRoot, 'src', 'app', 'layout.jsx'),
    path.join(shadowRoot, 'app', 'layout.tsx'),
    path.join(shadowRoot, 'app', 'layout.jsx'),
  );

  const cssFromLayout: string[] = [];
  if (layout) {
    const importRe = /import\s+['"]([^'"]+\.(?:css|scss|sass))['"]/g;
    let match: RegExpExecArray | null;
    while ((match = importRe.exec(layout.content)) !== null) {
      cssFromLayout.push(match[1]);
    }
  }

  const srcCss = listCssFiles(path.join(shadowRoot, 'src'));
  const hasGlobalCss = srcCss.length > 0 || cssFromLayout.length > 0;

  if (!main) {
    if (hasGlobalCss) {
      issues.push({
        filePath: path.join(shadowRoot, 'src', 'main.tsx'),
        errors: [
          'Missing Vite/React entry (src/main.tsx). Create it so it mounts the app into #root and imports the global CSS that Next layout used to load.',
        ],
      });
    }
    return issues;
  }

  const entryImportsCss = /import\s+['"][^'"]+\.(?:css|scss|sass)['"]/.test(main.content);
  if (hasGlobalCss && !entryImportsCss) {
    const hint = cssFromLayout[0]
      || (srcCss[0] ? `./${path.basename(srcCss[0])}` : './index.css');
    issues.push({
      filePath: main.filePath,
      errors: [
        `Global CSS is not imported from the SPA entry. Next.js applied styles via layout; Vite only bundles CSS imported from JS. Add \`import '${hint}'\` (or the path layout used) to ${path.basename(main.filePath)}.`,
      ],
    });
  }

  const html = readIfExists(path.join(shadowRoot, 'index.html'));
  if (html && !/src\/main\.(t|j)sx?/.test(html.content) && !/\/src\/index\.(t|j)sx?/.test(html.content)) {
    issues.push({
      filePath: html.filePath,
      errors: [
        'index.html must load the SPA entry as a module script (typically <script type="module" src="/src/main.tsx">).',
      ],
    });
  }

  const viteConfig = readIfExists(
    path.join(shadowRoot, 'vite.config.ts'),
    path.join(shadowRoot, 'vite.config.js'),
  );
  if (viteConfig && /__dirname/.test(viteConfig.content) && !/import\.meta\.dirname/.test(viteConfig.content)) {
    issues.push({
      filePath: viteConfig.filePath,
      errors: [
        'vite.config.ts uses __dirname in ESM. Replace it with import.meta.dirname so aliases and CSS resolution work under Vite.',
      ],
    });
  }

  return issues;
}

export const nextToReactPlugin: MigrationPlugin = {
  id: 'next-to-react',
  source: 'next',
  target: 'react',
  layer: 'frontend',
  fileHint(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    if (/\/(main|index)\.(t|j)sx?$/i.test(normalized) && !/\/src\/app\//i.test(normalized)) {
      return `
This is the Vite/React entry. It must:
1. import the global CSS Next loaded from layout (often ./index.css)
2. wrap the tree in BrowserRouter
3. render the former home screen (whatever the source used as "/")
Never render only an empty mount node — Vite will show a blank page and still report ready.
`;
    }
    if (/layout\.(t|j)sx?$/i.test(normalized) && /\/(src\/)?app\//i.test(normalized)) {
      return `
This Next layout will not run in Vite. Move its global CSS import to src/main.tsx and its HTML shell into index.html. Then delete this layout after the SPA boots.
`;
    }
    return '';
  },
  verifyShadow(shadowRoot) {
    return [...analyzeNextToReactStyles(shadowRoot), ...analyzeNextToReactBootstrap(shadowRoot)];
  },
  repairTargets(shadowRoot) {
    return [
      path.join(shadowRoot, 'package.json'),
      path.join(shadowRoot, 'vite.config.ts'),
      path.join(shadowRoot, 'vite.config.js'),
      path.join(shadowRoot, 'index.html'),
      path.join(shadowRoot, 'src', 'main.tsx'),
      path.join(shadowRoot, 'src', 'main.jsx'),
      path.join(shadowRoot, 'src', 'App.tsx'),
      path.join(shadowRoot, 'src', 'App.jsx'),
    ];
  },
};
