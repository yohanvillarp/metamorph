import type { FrameworkPack } from './types';

export const reactPack: FrameworkPack = {
  contract: [
    'React SPA bootstrap is index.html + src/main.tsx (or main.jsx) mounting into #root with createRoot.',
    'When React is the target, createRoot(...).render must mount the real application (router + screens), not an empty div or placeholder.',
  ],
  components: [
    'UI is function components. Preserve hooks, context, and the existing prop names of each component.',
    'Callback/event prop names declared on a component are its public API. A wrapper that renames them to look idiomatic still compiles and often crashes at runtime.',
  ],
  routing: [
    'SPA routing is react-router-dom (BrowserRouter / createBrowserRouter). Routes render existing screen components.',
  ],
  styling: [
    'Global CSS must be imported from the JS/TS entry (e.g. import "./index.css" in src/main.tsx).',
  ],
  antiPatterns: [
    'Do not reassemble leaf components inside main.tsx or a new App.tsx when a route-level screen already exists — import that screen.',
  ],
};
