import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  analyzeReactToNextStructure,
  analyzeCallbackPropMismatches,
} from '../utils/NextMigrationHints';
import {
  collectShadowIssues,
  collectRepairTargets,
} from './registry';
import { registerBuiltinMigrationPlugins } from './plugins';

describe('NextMigrationHints & Structure Regression Harness', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metamorph-fixture-'));
    registerBuiltinMigrationPlugins();
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('detects missing App Router home (src/app/page.tsx)', () => {
    const issues = analyzeReactToNextStructure(tmpDir);
    const missingHome = issues.find((i) => i.filePath.includes('src/app/page.tsx') || i.filePath.includes('src\\app\\page.tsx'));
    assert.ok(missingHome, 'Should detect missing src/app/page.tsx');
    assert.ok(missingHome.errors.some((e) => e.includes('Missing App Router home')));
  });

  it('detects stub or empty src/app/page.tsx', () => {
    const appDir = path.join(tmpDir, 'src', 'app');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'page.tsx'),
      `export default function Page() {\n  return <main />;\n}\n`
    );

    const issues = analyzeReactToNextStructure(tmpDir);
    const stubIssue = issues.find((i) => i.filePath.includes('page.tsx'));
    assert.ok(stubIssue, 'Should flag stub page');
    assert.ok(stubIssue.errors.some((e) => e.includes('does not render the application UI')));
  });

  it('detects leftover SPA pages under src/pages (Pages Router collision)', () => {
    const appDir = path.join(tmpDir, 'src', 'app');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'page.tsx'),
      `import { HomeView } from '../views/HomeView';\nexport default function Page() {\n  return <HomeView />;\n}\n`
    );

    const oldPagesDir = path.join(tmpDir, 'src', 'pages', 'dashboard');
    fs.mkdirSync(oldPagesDir, { recursive: true });
    fs.writeFileSync(
      path.join(oldPagesDir, 'DashboardPage.tsx'),
      `export function DashboardPage() { return <div>Dashboard</div>; }`
    );

    const issues = analyzeReactToNextStructure(tmpDir);
    const pagesIssue = issues.find((i) => i.filePath.includes('DashboardPage.tsx'));
    assert.ok(pagesIssue, 'Should flag leftover file in src/pages');
    assert.ok(pagesIssue.errors.some((e) => e.includes('still lives under src/pages')));
  });

  it('detects callback prop mismatches between view declaration and router wrapper', () => {
    const viewsDir = path.join(tmpDir, 'src', 'views');
    fs.mkdirSync(viewsDir, { recursive: true });
    fs.writeFileSync(
      path.join(viewsDir, 'TasksView.tsx'),
      `interface TasksViewProps {\n  onTaskCompleted: (id: string) => void;\n}\nexport function TasksView({ onTaskCompleted }: TasksViewProps) {\n  return <div>Tasks</div>;\n}\n`
    );

    const appDir = path.join(tmpDir, 'src', 'app', 'tasks');
    fs.mkdirSync(appDir, { recursive: true });
    // Wrapper passes "onDone" instead of declared "onTaskCompleted"
    fs.writeFileSync(
      path.join(appDir, 'page.tsx'),
      `import { TasksView } from '../../views/TasksView';\nexport default function TasksPage() {\n  return <TasksView onDone={() => {}} />;\n}\n`
    );

    const issues = analyzeCallbackPropMismatches(tmpDir);
    assert.ok(issues.length > 0, 'Should detect callback prop mismatch');
    assert.ok(issues[0].errors[0].includes('public callback props do not match'));
  });

  it('detects leftover Vite scripts in package.json', () => {
    const appDir = path.join(tmpDir, 'src', 'app');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'page.tsx'),
      `import { HomeView } from '../views/HomeView';\nexport default function Page() {\n  return <HomeView />;\n}\n`
    );

    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        scripts: {
          dev: 'vite',
          build: 'vite build',
        },
      })
    );

    const issues = analyzeReactToNextStructure(tmpDir);
    const pkgIssue = issues.find((i) => i.filePath.includes('package.json'));
    assert.ok(pkgIssue, 'Should flag Vite scripts in package.json');
    assert.ok(pkgIssue.errors.some((e) => e.includes('still runs Vite in scripts')));
  });

  it('collectShadowIssues and collectRepairTargets integrate cleanly without LLM', () => {
    // Create a shadow directory with broken App Router structure
    const appDir = path.join(tmpDir, 'src', 'app');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'page.tsx'),
      `return null;`
    );
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'fixture', scripts: { dev: 'next dev' } })
    );

    const issues = collectShadowIssues(tmpDir, { source: 'react', target: 'next' }, 'frontend');
    assert.ok(issues.length > 0, 'collectShadowIssues should report broken structure');

    // Case 1: Pinpoint repair targets when specific issues/compiler errors exist
    const pinpointTargets = collectRepairTargets(tmpDir, { source: 'react', target: 'next' }, {
      issues,
      implicated: [path.join(tmpDir, 'src', 'app', 'broken.tsx')],
    });

    assert.ok(pinpointTargets.some((t) => t.endsWith('page.tsx')), 'Pinpoint targets must include page.tsx');
    assert.ok(pinpointTargets.some((t) => t.endsWith('broken.tsx')), 'Pinpoint targets must include compiler implicated file');

    // Case 2: Fallback repair targets when no pinpoint errors are available
    const fallbackTargets = collectRepairTargets(tmpDir, { source: 'react', target: 'next' }, {});
    assert.ok(fallbackTargets.some((t) => t.endsWith('package.json')), 'Fallback targets must include package.json');
    assert.ok(fallbackTargets.some((t) => t.endsWith('page.tsx')), 'Fallback targets must include plugin app router files');
  });

  it('detects src/app/page.tsx that imports a missing ../App', () => {
    const appDir = path.join(tmpDir, 'src', 'app');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'page.tsx'),
      `'use client'\nimport App from '../App'\n\nexport default function Page() {\n  return <App />\n}\n`
    );

    const issues = analyzeReactToNextStructure(tmpDir);
    const pageIssues = issues.filter((i) => i.filePath.includes('page.tsx'));
    assert.ok(pageIssues.length > 0, 'Should flag page.tsx that imports a deleted App');
    const text = pageIssues.flatMap((i) => i.errors).join('\n');
    assert.match(text, /\.\.\/App/);

    const viaPlugin = collectShadowIssues(tmpDir, { source: 'react', target: 'next' }, 'frontend');
    assert.match(viaPlugin.flatMap((i) => i.errors).join('\n'), /\.\.\/App/);
  });

  it('passes cleanly with zero issues on a correctly structured Next App Router', () => {
    const viewsDir = path.join(tmpDir, 'src', 'views');
    fs.mkdirSync(viewsDir, { recursive: true });
    fs.writeFileSync(
      path.join(viewsDir, 'HomeView.tsx'),
      `interface HomeViewProps {\n  onStart: () => void;\n}\nexport function HomeView({ onStart }: HomeViewProps) {\n  return <div>Welcome Home</div>;\n}\n`
    );

    const appDir = path.join(tmpDir, 'src', 'app');
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, 'page.tsx'),
      `import { HomeView } from '../views/HomeView';\nexport default function Page() {\n  return <HomeView onStart={() => {}} />;\n}\n`
    );
    fs.writeFileSync(
      path.join(appDir, 'layout.tsx'),
      `export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return <html><body>{children}</body></html>;\n}\n`
    );

    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'valid-next-app',
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
        },
      })
    );

    const issues = analyzeReactToNextStructure(tmpDir);
    assert.strictEqual(issues.length, 0, 'A well-formed Next.js App Router must have zero structural issues');
  });
});
