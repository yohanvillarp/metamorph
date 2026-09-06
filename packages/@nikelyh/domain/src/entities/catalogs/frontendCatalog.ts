import { MigrationCatalogEntry } from './types';

export const frontendCatalog: MigrationCatalogEntry[] = [
  {
    source: 'react',
    target: 'next',
    description: 'Migration from a plain React SPA (like Vite or Create React App) to Next.js using the App Router.',
    filesToDelete: ['vite.config.ts', 'vite.config.js', 'index.html'],
    dependenciesToRemove: ['react-router-dom', 'vite', '@vitejs/plugin-react'],
    dependenciesToAdd: { 'next': 'latest', 'react': 'latest', 'react-dom': 'latest' },
    devDependenciesToRemove: [],
    devDependenciesToAdd: {},
    scriptsToUpdate: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      lint: 'next lint'
    },
    architecturalRules: [
      'Migrate standard React routing (e.g. react-router-dom) to Next.js file-system routing in the "app" directory.',
      'Convert the legacy entry points and root components (e.g., main.tsx, index.tsx, App.tsx) into Next.js app/layout.tsx and app/page.tsx.',
      'Delete the original entry point and root component files entirely after moving their logic to the new App Router files. Never leave legacy files acting as proxies (exporting/importing the new Next.js files), as this leads to cyclic dependencies and server-side rendering crashes.',
      'For components that use browser-only APIs (like window, useEffect, useState), add the "use client" directive at the very top of the file.',
      'Remove any react-router-dom <BrowserRouter>, <Routes>, and <Route> components.',
      'Replace react-router-dom <Link> components with Next.js next/link <Link> components.',
      'You are authorized to rename, create, or delete files to restructure the source into the Next.js App Router structure (e.g. app/page.tsx, app/layout.tsx).'
    ],
    examples: [
      {
        description: 'Converting a React Router setup to Next.js App Router',
        before: `import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './Home';
import About from './About';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </BrowserRouter>
  );
}`,
        after: `// This routing logic is deleted.
// Instead, create app/page.tsx for Home and app/about/page.tsx for About.`
      }
    ]
  },
  {
    source: 'next',
    target: 'react',
    description: 'Migration from Next.js to a plain React SPA using Vite.',
    filesToDelete: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    dependenciesToRemove: ['next'],
    dependenciesToAdd: { 'react-router-dom': 'latest' },
    devDependenciesToRemove: [],
    devDependenciesToAdd: { 'vite': 'latest', '@vitejs/plugin-react': 'latest' },
    scriptsToUpdate: {
      dev: 'vite',
      build: 'tsc -b && vite build',
      preview: 'vite preview'
    },
    architecturalRules: [
      'Replace Next.js file-system routing (app/ or pages/) with declarative React Router (react-router-dom) components.',
      'Remove all "use client" and "use server" directives, as they are Next.js specific.',
      'Convert Next.js Server Components into standard React Client Components (they will need to fetch data via useEffect or a data-fetching library).',
      'Replace Next.js <Link href="..."> with React Router <Link to="...">.',
      'Replace Next.js next/image <Image> with standard HTML <img>.',
      'Create a standard Vite entry point (index.html at the root, and src/main.tsx) to bootstrap the React application.'
    ]
  },
  {
    source: 'vue',
    target: 'react',
    description: 'Migration from Vue.js (Vue 3 Composition API) to React.',
    filesToDelete: ['vite.config.ts', 'vue.config.js'],
    dependenciesToRemove: ['vue', 'vue-router', 'pinia'],
    dependenciesToAdd: { 'react': 'latest', 'react-dom': 'latest', 'react-router-dom': 'latest' },
    devDependenciesToRemove: ['@vitejs/plugin-vue'],
    devDependenciesToAdd: { '@vitejs/plugin-react': 'latest' },
    architecturalRules: [
      'Convert all .vue Single File Components (SFC) into .tsx or .jsx React function components.',
      'Replace Vue <template> with React JSX/TSX return statements.',
      'Replace Vue ref() and reactive() with React useState().',
      'Replace Vue computed() with React useMemo().',
      'Replace Vue watch() and lifecycle hooks (onMounted, etc.) with React useEffect().',
      'Replace vue-router with react-router-dom.',
      'Convert Vue props definition (defineProps) into React function component parameters.',
      'Convert Vue emit (defineEmits) into React callback props (e.g. onAction={...}).'
    ]
  },
  {
    source: 'react',
    target: 'vue',
    description: 'Migration from React to Vue.js (Vue 3 Composition API).',
    filesToDelete: ['vite.config.ts'],
    dependenciesToRemove: ['react', 'react-dom', 'react-router-dom'],
    dependenciesToAdd: { 'vue': 'latest', 'vue-router': 'latest' },
    devDependenciesToRemove: ['@vitejs/plugin-react'],
    devDependenciesToAdd: { '@vitejs/plugin-vue': 'latest' },
    architecturalRules: [
      'Convert React .tsx/.jsx function components into Vue 3 .vue Single File Components (using <script setup>).',
      'Move the JSX return statement into the Vue <template> block.',
      'Replace React useState() with Vue ref() or reactive().',
      'Replace React useMemo() with Vue computed().',
      'Replace React useEffect() with Vue watch() or lifecycle hooks (onMounted).',
      'Replace react-router-dom with vue-router.',
      'Extract component props into defineProps().',
      'Extract callback props (e.g. onClick) into defineEmits() and emit events.'
    ]
  }
];
