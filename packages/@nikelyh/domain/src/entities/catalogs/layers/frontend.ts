/** Frontend layer: SPA / SSR / meta-frameworks. True for every UI pair — not repeated in Vue/Angular/Svelte packs. */
export const FRONTEND_LAYER_RULES: string[] = [
  'Preserve every stylesheet the source loaded: global CSS, CSS modules, Tailwind/PostCSS entry, fonts, and static assets. An unstyled HTML shell that "builds" is a failed migration.',
  'The target bootstrap must import the same global CSS the source root imported. Wiring CSS only in a deleted layout/HTML file is not enough.',
  'Keep public/ (or equivalent) assets and favicon references working in the target bundler.',
  'Map every user-facing route to an equivalent in the target router. Do not drop screens because the folder convention changed.',
  'When a new router or bootstrap file wraps an existing screen, import that screen and return/render it. Do not copy its template/JSX into the wrapper.',
  'Client-only APIs (window, document, localStorage) must still run; wrap or gate them for SSR targets instead of removing them.',
  'A successful compiler/build is not success if the home route is blank, the old bundler scripts remain, or leftover source-framework folders still register routes.',
];
