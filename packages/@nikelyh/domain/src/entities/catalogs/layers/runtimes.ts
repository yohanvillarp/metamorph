/**
 * Target toolchain (how the app is built and served).
 * Distinct from framework component models. Applied when that runtime is the target.
 */
export type TargetRuntime = 'vite-spa' | 'next-app' | 'angular-cli';

export const VITE_SPA_RUNTIME_RULES: string[] = [
  'Vite SPA: index.html at the repo root loads src/main.ts (or main.tsx) as type="module".',
  'vite.config.ts must use the plugin for the target (react / vue / svelte). In ESM use import.meta.dirname — never __dirname.',
  'package.json scripts must be Vite (dev/build/preview). Delete leftover next / ng serve / vue-cli-service scripts.',
  'Global CSS is imported from the JS/TS entry (or the root SFC). Vite does not apply CSS that only lived in a deleted framework layout.',
];

export const NEXT_APP_RUNTIME_RULES: string[] = [
  'Next App Router: routes are src/app/**/page.tsx (or app/). layout.tsx is the HTML shell and typically the global CSS import.',
  'src/pages is the Pages Router. SPA UI that lived under src/pages must move to a non-reserved folder before it can stay on disk, then be imported from src/app.',
  'package.json scripts must be next (dev/build/start). Delete leftover vite preview scripts.',
];

export const ANGULAR_CLI_RUNTIME_RULES: string[] = [
  'Angular CLI: angular.json is required. ng build / ng serve read architect.builder — a Vite config left behind will not run this app.',
  'Browser entry is src/main.ts → bootstrapApplication. The HTML shell is src/index.html (not a Vite root index.html). Delete the Vite index.html and vite.config.* when Angular is the target.',
  'package.json scripts must be ng serve / ng build. Delete leftover vite / next scripts.',
  'Global styles go in the angular.json styles array (often src/styles.css) and must still include the source global CSS.',
];

export function targetRuntimeFor(target: string): TargetRuntime | undefined {
  const id = target.toLowerCase();
  if (id === 'react' || id === 'vue' || id === 'svelte') return 'vite-spa';
  if (id === 'next') return 'next-app';
  if (id === 'angular') return 'angular-cli';
  return undefined;
}

export function rulesForTargetRuntime(target: string): string[] {
  const runtime = targetRuntimeFor(target);
  if (runtime === 'vite-spa') return VITE_SPA_RUNTIME_RULES;
  if (runtime === 'next-app') return NEXT_APP_RUNTIME_RULES;
  if (runtime === 'angular-cli') return ANGULAR_CLI_RUNTIME_RULES;
  return [];
}

export function labelForTargetRuntime(target: string): string {
  const runtime = targetRuntimeFor(target);
  if (runtime === 'vite-spa') return `Target runtime: Vite SPA (${target})`;
  if (runtime === 'next-app') return 'Target runtime: Next.js App Router';
  if (runtime === 'angular-cli') return 'Target runtime: Angular CLI';
  return `Target runtime: ${target}`;
}
