import * as fs from 'fs';
import * as path from 'path';

export function findShadowRoot(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');
  const marker = '/.metamorph/shadow/';
  const index = normalized.indexOf(marker);
  if (index === -1) return null;
  const after = normalized.slice(index + marker.length);
  const runId = after.split('/')[0];
  if (!runId) return null;
  return filePath.slice(0, index + marker.length + runId.length);
}

export function isFsdPageComponent(filePath: string): boolean {
  return /[/\\]src[/\\]pages[/\\][^/\\]+[/\\]ui[/\\]/i.test(filePath);
}

export function isSpaRootComponent(filePath: string): boolean {
  return /[/\\](App|main|index)\.(t|j)sx?$/i.test(filePath)
    && !/[/\\]src[/\\]app[/\\]/i.test(filePath)
    && !isFsdPageComponent(filePath);
}

export function hasNextAppRoutes(shadowRoot: string): boolean {
  const appDir = path.join(shadowRoot, 'src', 'app');
  if (!fs.existsSync(appDir)) return false;
  const stack = [appDir];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        stack.push(path.join(dir, entry.name));
      } else if (entry.name === 'page.tsx' || entry.name === 'page.jsx' || entry.name === 'page.js') {
        return true;
      }
    }
  }
  return false;
}

export function nextMigrationFileHint(filePath: string, target: string): string {
  if (target !== 'next') return '';
  if (isFsdPageComponent(filePath) || isSpaPagesTreeFile(filePath)) {
    return `
This file sits under src/pages. In Next.js that directory is the Pages Router.
Move this file out of src/pages (keep the component and its business logic) into a folder Next does not treat as routes.
Then add or update src/app/<route>/page.tsx so the App Router imports that screen for the former URL.
The home route ("/") is src/app/page.tsx and must render the former "/" screen — not an empty shell, null, a TODO, or a deleted App.tsx.
Delete the old src/pages copy after the screen exists elsewhere.
`;
  }
  if (isSpaRootComponent(filePath)) {
    return `
This is a SPA root/entry file (App.tsx / main.tsx / index.tsx).
Read it and map each route to src/app/<path>/page.tsx that imports the actual screen component (after moving anything that lived under src/pages).
src/app/page.tsx must render the home screen. Never import App from the new page (App is being removed).
Never write a stub that the root component "could not be resolved". After App Router files exist with real UI, delete this legacy root file.
`;
  }
  if (/[/\\]src[/\\]app[/\\].*page\.(t|j)sx$/i.test(filePath)) {
    return `
This is a Next App Router page. Import the existing screen component and return it.
Do not paste that screen's JSX here. Do not rename its public props at the wrapper.
Do not hollow out the module you imported from.
`;
  }
  return '';
}

const NEXT_PAGES_RESERVED = /(?:^|[/\\])(_app|_document|_error|404|500)\.(t|j)sx?$/i;

export function isSpaPagesTreeFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  if (!/\/src\/pages\//i.test(normalized)) return false;
  if (/\/src\/pages\/api\//i.test(normalized)) return false;
  if (NEXT_PAGES_RESERVED.test(normalized)) return false;
  return true;
}

export interface NextStructureIssue {
  filePath: string;
  errors: string[];
}

function listFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.(t|j)sx?$/.test(entry.name)) out.push(full);
    }
  }
  return out;
}

function findAppRouterHome(shadowRoot: string): string | null {
  const candidates = [
    path.join(shadowRoot, 'src', 'app', 'page.tsx'),
    path.join(shadowRoot, 'src', 'app', 'page.jsx'),
    path.join(shadowRoot, 'app', 'page.tsx'),
    path.join(shadowRoot, 'app', 'page.jsx'),
  ];
  return candidates.find((file) => fs.existsSync(file)) || null;
}

export function listAppRouterFiles(shadowRoot: string): string[] {
  const roots = [path.join(shadowRoot, 'src', 'app'), path.join(shadowRoot, 'app')];
  const names = /^(page|layout)\.(t|j)sx$/i;
  return roots.flatMap((dir) => listFilesRecursive(dir).filter((file) => names.test(path.basename(file))));
}

export function isHollowView(content: string): boolean {
  const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const hasFeatureImports = /from\s+['"][^'"]*\/(features|entities|widgets)\//.test(withoutComments);
  const tinyTree = /<h1[^>]*>[^<]{0,40}<\/h1>/.test(withoutComments) && !hasFeatureImports;
  const emptyMain = /<main>\s*<h1>/.test(withoutComments) && !hasFeatureImports;
  return tinyTree || emptyMain;
}

function findViewPages(shadowRoot: string): string[] {
  const viewsDir = path.join(shadowRoot, 'src', 'views');
  return listFilesRecursive(viewsDir).filter((file) => /(?:^|[/\\])(?:.+Page|page)\.(t|j)sx$/i.test(file));
}

function localTsxImports(fromFile: string, content: string): Array<{ tag: string; absPath: string }> {
  const dir = path.dirname(fromFile);
  const out: Array<{ tag: string; absPath: string }> = [];
  const re = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"](\.\.?\/[^'"]+|@\/[^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const resolved = match[3].startsWith('@/')
      ? path.join(findSrcRoot(fromFile), match[3].slice(2))
      : path.resolve(dir, match[3]);
    const candidates = [
      resolved,
      `${resolved}.tsx`,
      `${resolved}.jsx`,
      `${resolved}.ts`,
      path.join(resolved, 'index.tsx'),
      path.join(resolved, 'index.ts'),
    ];
    const absPath = candidates.find((file) => fs.existsSync(file));
    if (!absPath) continue;
    if (match[2]) out.push({ tag: match[2], absPath });
    if (match[1]) {
      for (const part of match[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (name) out.push({ tag: name, absPath });
      }
    }
  }
  return out;
}

function findSrcRoot(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/src/');
  if (idx === -1) return path.dirname(filePath);
  return filePath.slice(0, idx + 4);
}

function declaredCallbackProps(componentSource: string): string[] {
  const names = new Set<string>();
  const iface = /interface\s+\w+\s*\{([^}]+)\}/g;
  let block: RegExpExecArray | null;
  while ((block = iface.exec(componentSource)) !== null) {
    const field = /(\b(?:on[A-Z]\w+|action[A-Z]\w+)\??)\s*:/g;
    let f: RegExpExecArray | null;
    while ((f = field.exec(block[1])) !== null) names.add(f[1].replace('?', ''));
  }
  const dest = /export\s+(?:default\s+)?function\s+\w+\s*\(\s*\{\s*([^}]+)\}/;
  const d = dest.exec(componentSource);
  if (d) {
    for (const part of d[1].split(',')) {
      const name = part.trim().split(':')[0].trim();
      if (/^(on[A-Z]|action[A-Z])/.test(name)) names.add(name);
    }
  }
  return [...names];
}

function jsxCallbackProps(callerSource: string, tag: string): string[] {
  const names: string[] = [];
  const tagRe = new RegExp(`<${tag}\\b([^>]*)\\/?>`, 'g');
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(callerSource)) !== null) {
    const propRe = /\b((?:on|action)[A-Z]\w+)\s*=/g;
    let p: RegExpExecArray | null;
    while ((p = propRe.exec(match[1])) !== null) names.push(p[1]);
  }
  return names;
}

export function analyzeCallbackPropMismatches(shadowRoot: string): NextStructureIssue[] {
  const issues: NextStructureIssue[] = [];
  const files = [
    ...listFilesRecursive(path.join(shadowRoot, 'src', 'app')),
    ...listFilesRecursive(path.join(shadowRoot, 'app')),
    ...listFilesRecursive(path.join(shadowRoot, 'src', 'views')),
  ].filter((file) => /\.(t|j)sx$/.test(file));

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    for (const imp of localTsxImports(file, content)) {
      let callee: string;
      try {
        callee = fs.readFileSync(imp.absPath, 'utf-8');
      } catch {
        continue;
      }
      const expected = declaredCallbackProps(callee);
      if (expected.length === 0) continue;
      const passed = jsxCallbackProps(content, imp.tag);
      const missing = expected.filter((name) => !passed.includes(name));
      const extra = passed.filter((name) => !expected.includes(name));
      if (missing.length === 0 && extra.length === 0) continue;
      issues.push({
        filePath: file,
        errors: [
          `<${imp.tag}> public callback props do not match ${path.relative(shadowRoot, imp.absPath)}. Expected: ${expected.join(', ') || '(none)'}. Passed: ${passed.join(', ') || '(none)'}. Do not rename props when wrapping a screen in a router file.`,
        ],
      });
    }
  }
  return issues;
}

export function analyzeReactToNextComposition(shadowRoot: string): NextStructureIssue[] {
  const issues: NextStructureIssue[] = [];
  const home = findAppRouterHome(shadowRoot);
  if (!home) return issues;
  const homeContent = fs.readFileSync(home, 'utf-8');
  const views = findViewPages(shadowRoot);
  const hollowViews = views.filter((file) => isHollowView(fs.readFileSync(file, 'utf-8')));
  const homeImportsView = views.some((file) => {
    const stem = path.basename(file).replace(/\.(t|j)sx$/, '');
    return homeContent.includes(stem);
  });
  const homeAssemblesFeatures = /from\s+['"][^'"]*\/(features|entities|widgets)\//.test(homeContent);

  if (views.length > 0 && !homeImportsView && homeAssemblesFeatures) {
    issues.push({
      filePath: home,
      errors: [
        'The App Router home reassembles the UI from lower-level modules instead of importing the existing route-level screen. Import that screen and return it. Renaming props at the wrapper causes runtime TypeError while next build still succeeds.',
      ],
    });
  }

  for (const file of hollowViews) {
    issues.push({
      filePath: file,
      errors: [
        'This screen was hollowed out. Restore the original UI here. The App Router page should import this file, not replace it with a stub heading.',
      ],
    });
  }

  return issues;
}

export function isStubAppRouterPage(content: string): boolean {
  const hasLocalImport = /from\s+['"](\.\.?\/|@\/)/.test(content);
  const emptyish = /return\s*\(\s*<main\s*\/>\s*\)|return\s+null\s*;?|return\s*\(\s*<>\s*<\/>\s*\)|TODO:|could not be resolved/i.test(content);
  const onlyLayoutShell = /<main\s*\/>/.test(content) && !hasLocalImport;
  return !hasLocalImport || emptyish || onlyLayoutShell;
}

/**
 * SPA → Next App Router failure modes that still `next build` successfully:
 * leftover src/pages UI (Pages Router hijack) and a home page that renders nothing.
 */
export function analyzeReactToNextStructure(shadowRoot: string): NextStructureIssue[] {
  const issues: NextStructureIssue[] = [];
  const pagesDir = path.join(shadowRoot, 'src', 'pages');
  if (fs.existsSync(pagesDir)) {
    for (const file of listFilesRecursive(pagesDir)) {
      if (!isSpaPagesTreeFile(file)) continue;
      issues.push({
        filePath: file,
        errors: [
          'This UI still lives under src/pages. Next.js will treat it as a Pages Router route. Move it to a folder Next does not reserve, then import it from src/app/**/page.tsx for the old URL. Remove the src/pages copy.',
        ],
      });
    }
  }

  const home = findAppRouterHome(shadowRoot);
  if (!home) {
    issues.push({
      filePath: path.join(shadowRoot, 'src', 'app', 'page.tsx'),
      errors: [
        'Missing App Router home (src/app/page.tsx). Create it so it imports and renders the screen the SPA showed at "/".',
      ],
    });
    return issues;
  }

  const homeContent = fs.readFileSync(home, 'utf-8');
  if (isStubAppRouterPage(homeContent)) {
    issues.push({
      filePath: home,
      errors: [
        'src/app/page.tsx does not render the application UI. Import the former home screen component (after moving any SPA UI out of src/pages if needed). Do not return an empty shell, null, a TODO, or a deleted App.tsx.',
      ],
    });
  }

  issues.push(...analyzeReactToNextComposition(shadowRoot));
  issues.push(...analyzeCallbackPropMismatches(shadowRoot));

  const pkgPath = path.join(shadowRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> };
      const viteScripts = Object.entries(pkg.scripts || {}).filter(([, cmd]) => /\bvite\b/.test(cmd));
      if (viteScripts.length > 0) {
        issues.push({
          filePath: pkgPath,
          errors: [
            `package.json still runs Vite in scripts (${viteScripts.map(([name]) => name).join(', ')}). After moving to Next, drop leftover preview/vite scripts.`,
          ],
        });
      }
    } catch {
      // ignore malformed json
    }
  }

  return issues;
}
