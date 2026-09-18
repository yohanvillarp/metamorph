import { MigrationCatalogEntry } from './types';
import {
  ANGULAR_FILES_TO_DELETE,
  ANGULAR_SCAFFOLDS,
  ANGULAR_SCRIPTS,
  NEXT_FILES_TO_DELETE,
  NEXT_SCAFFOLDS,
  NEXT_SCRIPTS,
  REACT_VITE_SCAFFOLDS,
  SVELTE_FILES_TO_DELETE,
  SVELTE_SCAFFOLDS,
  VITE_FILES_TO_DELETE,
  VITE_SPA_SCRIPTS,
  VUE_FILES_TO_DELETE,
  VUE_SCAFFOLDS,
} from './scaffolds';

const REACT_DEPS = { react: 'latest', 'react-dom': 'latest', 'react-router-dom': 'latest' };
const REACT_DEV = { vite: 'latest', '@vitejs/plugin-react': 'latest' };
const VUE_DEPS = { vue: 'latest', 'vue-router': 'latest' };
const VUE_DEV = { vite: 'latest', '@vitejs/plugin-vue': 'latest' };
const SVELTE_DEPS = { svelte: 'latest' };
const SVELTE_DEV = { vite: 'latest', '@sveltejs/vite-plugin-svelte': 'latest' };
const ANGULAR_DEPS = {
  '@angular/animations': 'latest',
  '@angular/common': 'latest',
  '@angular/compiler': 'latest',
  '@angular/core': 'latest',
  '@angular/forms': 'latest',
  '@angular/platform-browser': 'latest',
  '@angular/router': 'latest',
  rxjs: 'latest',
  tslib: 'latest',
  'zone.js': 'latest',
};
const ANGULAR_DEV = {
  '@angular-devkit/build-angular': 'latest',
  '@angular/cli': 'latest',
  '@angular/compiler-cli': 'latest',
  typescript: '~5.8.0',
};

const REACT_REMOVE = ['react', 'react-dom', 'react-router-dom'];
const REACT_DEV_REMOVE = ['@vitejs/plugin-react'];
const NEXT_REMOVE = ['next'];
const VUE_REMOVE = ['vue', 'vue-router', 'pinia', 'vuex'];
const VUE_DEV_REMOVE = ['@vitejs/plugin-vue'];
const SVELTE_REMOVE = ['svelte', 'svelte-spa-router', '@sveltejs/kit'];
const SVELTE_DEV_REMOVE = ['@sveltejs/vite-plugin-svelte', '@sveltejs/kit'];
const ANGULAR_REMOVE = [
  '@angular/animations',
  '@angular/common',
  '@angular/compiler',
  '@angular/core',
  '@angular/forms',
  '@angular/platform-browser',
  '@angular/platform-browser-dynamic',
  '@angular/router',
  'zone.js',
];
const ANGULAR_DEV_REMOVE = ['@angular/cli', '@angular/compiler-cli', '@angular-devkit/build-angular'];

const TO_REACT: Pick<MigrationCatalogEntry, 'dependenciesToAdd' | 'devDependenciesToAdd' | 'scriptsToUpdate' | 'filesToScaffold'> = {
  dependenciesToAdd: REACT_DEPS,
  devDependenciesToAdd: REACT_DEV,
  scriptsToUpdate: VITE_SPA_SCRIPTS,
  filesToScaffold: REACT_VITE_SCAFFOLDS,
};

const TO_VUE: Pick<MigrationCatalogEntry, 'dependenciesToAdd' | 'devDependenciesToAdd' | 'scriptsToUpdate' | 'filesToScaffold'> = {
  dependenciesToAdd: VUE_DEPS,
  devDependenciesToAdd: VUE_DEV,
  scriptsToUpdate: VITE_SPA_SCRIPTS,
  filesToScaffold: VUE_SCAFFOLDS,
};

const TO_SVELTE: Pick<MigrationCatalogEntry, 'dependenciesToAdd' | 'devDependenciesToAdd' | 'scriptsToUpdate' | 'filesToScaffold'> = {
  dependenciesToAdd: SVELTE_DEPS,
  devDependenciesToAdd: SVELTE_DEV,
  scriptsToUpdate: VITE_SPA_SCRIPTS,
  filesToScaffold: SVELTE_SCAFFOLDS,
};

const TO_ANGULAR: Pick<MigrationCatalogEntry, 'dependenciesToAdd' | 'devDependenciesToAdd' | 'scriptsToUpdate' | 'scriptsToRemove' | 'filesToScaffold'> = {
  dependenciesToAdd: ANGULAR_DEPS,
  devDependenciesToAdd: ANGULAR_DEV,
  scriptsToUpdate: ANGULAR_SCRIPTS,
  scriptsToRemove: ['preview'],
  filesToScaffold: ANGULAR_SCAFFOLDS,
};

const TO_NEXT: Pick<MigrationCatalogEntry, 'dependenciesToAdd' | 'devDependenciesToAdd' | 'scriptsToUpdate' | 'scriptsToRemove' | 'filesToScaffold'> = {
  dependenciesToAdd: { next: 'latest', react: 'latest', 'react-dom': 'latest' },
  devDependenciesToAdd: {},
  scriptsToUpdate: NEXT_SCRIPTS,
  scriptsToRemove: ['preview'],
  filesToScaffold: NEXT_SCAFFOLDS,
};

export const frontendCatalog: MigrationCatalogEntry[] = [
  {
    source: 'react',
    target: 'next',
    description: 'Migration from a plain React SPA (Vite or CRA) to Next.js App Router.',
    filesToDelete: [...VITE_FILES_TO_DELETE, 'index.html'],
    dependenciesToRemove: ['react-router-dom', 'vite', '@vitejs/plugin-react'],
    ...TO_NEXT,
    architecturalRules: [
      'Map react-router routes to src/app/**/page.tsx. Home ("/") is src/app/page.tsx importing the former home screen.',
      'If SPA UI lived under src/pages, move that tree out (Next reserves src/pages). Import those screens from src/app/**/page.tsx. Do not leave UI under src/pages.',
      'Delete the old SPA entry (main/App) after App Router files render real UI. Never import the old App from page.tsx (cycles / SSR crashes).',
      'Add "use client" only on files that use browser APIs or hooks.',
      'Replace react-router Link with next/link. Keep the imported screen\'s public prop names at the page.tsx wrapper.',
    ],
    examples: [
      {
        description: 'Wrap an existing screen; do not re-implement it',
        before: `// router table
<Route path="/" element={<HomeScreen />} />`,
        after: `// src/app/page.tsx
'use client';
import HomeScreen from '../screens/HomeScreen';
export default function Page() {
  return <HomeScreen />;
}`,
      },
    ],
  },
  {
    source: 'next',
    target: 'react',
    description: 'Migration from Next.js to a Vite React SPA.',
    filesToDelete: NEXT_FILES_TO_DELETE,
    dependenciesToRemove: NEXT_REMOVE,
    ...TO_REACT,
    architecturalRules: [
      'Replace App Router / Pages Router with react-router-dom. src/main.tsx wraps BrowserRouter and renders the former home screen.',
      'Strip "use client" / "use server". Replace next/link with react-router Link (href → to). Replace next/image with img.',
      'Move layout.tsx global CSS import to src/main.tsx. Delete leftover src/app/page.tsx and layout.tsx after the SPA boots.',
      'Do not use __dirname in vite.config.ts ESM.',
    ],
  },
  {
    source: 'vue',
    target: 'react',
    description: 'Vue 3 SFC → React function components on Vite.',
    filesToDelete: [...VUE_FILES_TO_DELETE],
    dependenciesToRemove: VUE_REMOVE,
    devDependenciesToRemove: VUE_DEV_REMOVE,
    ...TO_REACT,
    architecturalRules: [
      'Convert each .vue SFC to .tsx: <template> → JSX, <script setup> → function body, keep <style> as an imported CSS module or colocated css.',
      'defineProps fields stay prop names. Each emit X becomes onX (or the equivalent) with the same X. v-model stays whatever the SFC declared (modelValue / update:modelValue unless the source used another name).',
      'vue-router routes become react-router <Route> entries that import the converted screen. src/main.tsx mounts into #root.',
      'Pinia/Vuex stores become modules/hooks; keep action and getter names. Delete leftover .vue files after the .tsx exists.',
    ],
  },
  {
    source: 'react',
    target: 'vue',
    description: 'React function components → Vue 3 SFCs on Vite.',
    filesToDelete: [...VITE_FILES_TO_DELETE, 'index.html'],
    dependenciesToRemove: REACT_REMOVE,
    devDependenciesToRemove: REACT_DEV_REMOVE,
    ...TO_VUE,
    architecturalRules: [
      'Convert each .tsx/.jsx component to a .vue SFC with <script setup>. JSX return → <template>. useState → ref/reactive; useMemo → computed; useEffect → watch/onMounted.',
      'Function props stay defineProps names. Callback props stay the same names (as props or as defineEmits of the same event). Do not invent new event names.',
      'react-router becomes vue-router. App.vue has <router-view />. src/main.ts createApp(App).use(router).mount("#app").',
      'index.html must use #app (replace #root). Delete leftover .tsx screens after the SFC exists.',
    ],
  },
  {
    source: 'svelte',
    target: 'react',
    description: 'Svelte components → React function components on Vite.',
    filesToDelete: SVELTE_FILES_TO_DELETE,
    dependenciesToRemove: SVELTE_REMOVE,
    devDependenciesToRemove: SVELTE_DEV_REMOVE,
    ...TO_REACT,
    architecturalRules: [
      'Convert each .svelte file to .tsx. $props()/export let names stay prop names. Dispatcher events foo become onFoo.',
      '$state/$derived/$effect (or let/$: ) map to useState/useMemo/useEffect. Keep the same data flow.',
      'If the source used svelte-spa-router or a manual screen map, rebuild it with react-router importing those screens. Mount into #root.',
      'Delete leftover .svelte files after the React files exist. This is a Vite SPA, not Next.',
    ],
  },
  {
    source: 'react',
    target: 'svelte',
    description: 'React function components → Svelte 5 on Vite.',
    filesToDelete: [...VITE_FILES_TO_DELETE, 'index.html'],
    dependenciesToRemove: REACT_REMOVE,
    devDependenciesToRemove: REACT_DEV_REMOVE,
    ...TO_SVELTE,
    architecturalRules: [
      'Convert each .tsx component to .svelte. Props become $props() with the same names. Callbacks stay the same names as emits or callback props — do not rename.',
      'useState → $state, useMemo → $derived, useEffect → $effect. Keep business logic.',
      'react-router becomes a map in App.svelte (or svelte-spa-router) that renders existing screens. src/main.ts mount(App, { target: #app }).',
      'index.html uses #app. Do not create SvelteKit +page.svelte routes. Delete leftover .tsx after the .svelte exists.',
    ],
  },
  {
    source: 'angular',
    target: 'react',
    description: 'Angular standalone/NgModule → React SPA on Vite.',
    filesToDelete: ANGULAR_FILES_TO_DELETE,
    dependenciesToRemove: ANGULAR_REMOVE,
    devDependenciesToRemove: ANGULAR_DEV_REMOVE,
    ...TO_REACT,
    architecturalRules: [
      'Each @Component becomes a function component. @Input() names stay props. @Output() foo stays onFoo. Do not alias them in a wrapper.',
      'Templates (*ngIf, *ngFor, [ngModel]) become JSX. Keep component CSS (styleUrls) as imported stylesheets.',
      'app.routes.ts paths become react-router routes importing those converted components. src/main.tsx mounts into #root.',
      'Services with HTTP become modules/hooks; keep method names. Delete src/index.html Angular shell after Vite index.html exists. Strip Zone.js.',
    ],
  },
  {
    source: 'react',
    target: 'angular',
    description: 'React SPA → Angular standalone + CLI.',
    filesToDelete: [...VITE_FILES_TO_DELETE, 'index.html'],
    dependenciesToRemove: [...REACT_REMOVE, 'vite'],
    devDependenciesToRemove: REACT_DEV_REMOVE,
    ...TO_ANGULAR,
    architecturalRules: [
      'Each function component becomes a standalone @Component. Props become @Input() with the same names; onFoo becomes @Output() foo.',
      'app.ts is a shell with <router-outlet />. app.routes.ts lists former react-router paths pointing at those components — do not paste screen templates into App.',
      'Copy global CSS into src/styles.css (angular.json styles). Delete Vite index.html / vite.config after src/index.html and src/main.ts exist.',
      'Do not introduce an extra wrapper component that remaps inputs to "Angular style" names.',
    ],
  },
  {
    source: 'next',
    target: 'vue',
    description: 'Next.js App Router → Vue 3 Vite SPA.',
    filesToDelete: NEXT_FILES_TO_DELETE,
    dependenciesToRemove: [...NEXT_REMOVE, ...REACT_REMOVE],
    devDependenciesToRemove: [],
    ...TO_VUE,
    architecturalRules: [
      'Each App Router page.tsx becomes a vue-router route that imports the converted SFC of that screen — do not re-implement the page in the router.',
      'Strip next/link, next/image, use client. layout.tsx CSS import moves to src/main.ts. Delete leftover src/app after Vue boots.',
    ],
  },
  {
    source: 'vue',
    target: 'next',
    description: 'Vue 3 SPA → Next.js App Router.',
    filesToDelete: [...VITE_FILES_TO_DELETE, ...VUE_FILES_TO_DELETE, 'index.html'],
    dependenciesToRemove: [...VUE_REMOVE, 'vite'],
    devDependenciesToRemove: VUE_DEV_REMOVE,
    ...TO_NEXT,
    architecturalRules: [
      'Each vue-router path becomes src/app/<path>/page.tsx that imports the converted React screen (from the SFC). Home is src/app/page.tsx.',
      'If SPA UI lived under src/pages, move it out of that folder first. Keep emit/prop names when wrapping in page.tsx.',
    ],
  },
  {
    source: 'next',
    target: 'svelte',
    description: 'Next.js → Svelte 5 Vite SPA.',
    filesToDelete: NEXT_FILES_TO_DELETE,
    dependenciesToRemove: [...NEXT_REMOVE, ...REACT_REMOVE],
    ...TO_SVELTE,
    architecturalRules: [
      'Each App Router page becomes a .svelte screen imported from App.svelte (SPA map), not SvelteKit +page.svelte.',
      'Move layout CSS to src/main.ts. Delete leftover src/app after mount() works.',
    ],
  },
  {
    source: 'svelte',
    target: 'next',
    description: 'Svelte Vite SPA → Next.js App Router.',
    filesToDelete: [...VITE_FILES_TO_DELETE, ...SVELTE_FILES_TO_DELETE, 'index.html'],
    dependenciesToRemove: [...SVELTE_REMOVE, 'vite'],
    devDependenciesToRemove: SVELTE_DEV_REMOVE,
    ...TO_NEXT,
    architecturalRules: [
      'Each Svelte screen becomes a React component imported from src/app/**/page.tsx. Do not re-implement the screen in the route file.',
      'Keep $props / dispatcher names as React props. Home is src/app/page.tsx.',
    ],
  },
  {
    source: 'next',
    target: 'angular',
    description: 'Next.js → Angular CLI standalone.',
    filesToDelete: [...NEXT_FILES_TO_DELETE, 'index.html'],
    dependenciesToRemove: [...NEXT_REMOVE, ...REACT_REMOVE],
    ...TO_ANGULAR,
    architecturalRules: [
      'Each App Router page becomes an Angular standalone component referenced from app.routes.ts. App is only <router-outlet />.',
      'layout.tsx CSS goes to src/styles.css. Delete leftover src/app Next files after Angular src/app exists — they are different trees; finish the Angular files first, then remove page.tsx/layout.tsx.',
    ],
  },
  {
    source: 'angular',
    target: 'next',
    description: 'Angular → Next.js App Router.',
    filesToDelete: [...ANGULAR_FILES_TO_DELETE],
    dependenciesToRemove: ANGULAR_REMOVE,
    devDependenciesToRemove: ANGULAR_DEV_REMOVE,
    ...TO_NEXT,
    architecturalRules: [
      'Each Angular route component becomes a React screen imported from src/app/**/page.tsx. Keep @Input/@Output names as props.',
      'Delete src/index.html Angular shell after Next layout.tsx exists. Move global styles into the Next layout import.',
    ],
  },
  {
    source: 'vue',
    target: 'svelte',
    description: 'Vue 3 SFC → Svelte 5 on Vite.',
    filesToDelete: VUE_FILES_TO_DELETE,
    dependenciesToRemove: VUE_REMOVE,
    devDependenciesToRemove: VUE_DEV_REMOVE,
    ...TO_SVELTE,
    architecturalRules: [
      'Each .vue SFC becomes .svelte. defineProps → $props with the same names. defineEmits names stay the same — do not invent names.',
      'vue-router table becomes App.svelte screen map (or svelte-spa-router). Keep #app. Delete leftover .vue after conversion.',
    ],
  },
  {
    source: 'svelte',
    target: 'vue',
    description: 'Svelte → Vue 3 SFC on Vite.',
    filesToDelete: SVELTE_FILES_TO_DELETE,
    dependenciesToRemove: SVELTE_REMOVE,
    devDependenciesToRemove: SVELTE_DEV_REMOVE,
    ...TO_VUE,
    architecturalRules: [
      'Each .svelte file becomes .vue <script setup>. $props names stay defineProps. Dispatcher events stay defineEmits names.',
      'SPA map becomes vue-router. Keep #app. Delete leftover .svelte after conversion.',
    ],
  },
  {
    source: 'vue',
    target: 'angular',
    description: 'Vue 3 → Angular standalone + CLI.',
    filesToDelete: [...VITE_FILES_TO_DELETE, ...VUE_FILES_TO_DELETE, 'index.html'],
    dependenciesToRemove: [...VUE_REMOVE, 'vite'],
    devDependenciesToRemove: VUE_DEV_REMOVE,
    ...TO_ANGULAR,
    architecturalRules: [
      'Each SFC becomes a standalone @Component. defineProps → @Input same names; defineEmits("add") → @Output() add.',
      'vue-router paths become app.routes.ts. App is <router-outlet />. Global CSS → src/styles.css.',
    ],
  },
  {
    source: 'angular',
    target: 'vue',
    description: 'Angular → Vue 3 Vite SPA.',
    filesToDelete: ANGULAR_FILES_TO_DELETE,
    dependenciesToRemove: ANGULAR_REMOVE,
    devDependenciesToRemove: ANGULAR_DEV_REMOVE,
    ...TO_VUE,
    architecturalRules: [
      'Each Angular component becomes a .vue SFC. @Input → defineProps; @Output foo → defineEmits(["foo"]).',
      'app.routes.ts becomes vue-router. Mount #app. Delete Angular src/index.html after Vite index.html exists.',
    ],
  },
  {
    source: 'svelte',
    target: 'angular',
    description: 'Svelte Vite SPA → Angular CLI.',
    filesToDelete: [...VITE_FILES_TO_DELETE, ...SVELTE_FILES_TO_DELETE, 'index.html'],
    dependenciesToRemove: [...SVELTE_REMOVE, 'vite'],
    devDependenciesToRemove: SVELTE_DEV_REMOVE,
    ...TO_ANGULAR,
    architecturalRules: [
      'Each .svelte screen becomes a standalone @Component. $props names → @Input; dispatcher events → @Output with the same names.',
      'App.svelte map becomes app.routes.ts. App is <router-outlet />.',
    ],
  },
  {
    source: 'angular',
    target: 'svelte',
    description: 'Angular → Svelte 5 Vite SPA.',
    filesToDelete: ANGULAR_FILES_TO_DELETE,
    dependenciesToRemove: ANGULAR_REMOVE,
    devDependenciesToRemove: ANGULAR_DEV_REMOVE,
    ...TO_SVELTE,
    architecturalRules: [
      'Each Angular component becomes .svelte. @Input → $props; @Output foo → onFoo / emit foo — same names.',
      'app.routes.ts becomes App.svelte SPA map, not SvelteKit. Mount #app. Delete Angular src/index.html after Vite index.html exists.',
    ],
  },
];
