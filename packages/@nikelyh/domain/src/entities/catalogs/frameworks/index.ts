/**
 * Per-framework packs. Applied when that id is source, then again when it is target.
 * Component model lives here. Toolchain (Vite vs Next vs ng) lives in layers/runtimes.ts.
 */
export interface FrameworkPack {
  contract: string[];
  components: string[];
  routing: string[];
  styling: string[];
  antiPatterns: string[];
}

export const FRAMEWORK_PACKS: Record<string, FrameworkPack> = {
  react: {
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
  },
  next: {
    contract: [
      'App Router lives under src/app (or app/). page.tsx files are routes. layout.tsx is the HTML shell.',
      '"use client" / "use server" and next/link, next/image, next/navigation are Next-specific — strip them when leaving Next.',
    ],
    components: [
      'page.tsx should import the existing screen and return it. Do not paste that screen\'s JSX into the route file.',
    ],
    routing: [
      'src/pages is the Pages Router. If the SPA kept UI there, move that tree to a folder Next does not treat as routes, then import those screens from src/app.',
      'Replace react-router <Route> / <Link> with file-system routes and next/link when Next is the target.',
    ],
    styling: [
      'layout.tsx typically imports global CSS. When leaving Next, that import must move to the new SPA entry.',
    ],
    antiPatterns: [
      'Never hollow out an existing screen after creating App Router files. Never leave a stub src/app/page.tsx that returns an empty shell or TODO.',
      'Do not leave Vite preview scripts after moving to Next.',
    ],
  },
  vue: {
    contract: [
      'Vue 3 boots from src/main.ts: createApp(App).use(router).mount("#app"). index.html must have <div id="app"> — not #root.',
      'vite.config.ts uses @vitejs/plugin-vue. Add env.d.ts so TypeScript accepts *.vue modules.',
    ],
    components: [
      'UI is Single File Components (.vue) with <script setup>, <template>, and <style> (keep scoped styles on that component).',
      'defineProps names stay the prop names. defineEmits names stay the event names as declared in the SFC. Map to the target with the same names (React: onX for emit X). Do not invent new names.',
      'ref / reactive / computed / watch / onMounted are the state model. Do not drop them; map them (useState, useMemo, useEffect, or the target equivalent).',
    ],
    routing: [
      'vue-router: createRouter({ history: createWebHistory(), routes }). App.vue has <router-view />. Each route component is an existing SFC — do not inline screens in the router table.',
    ],
    styling: [
      'Keep SFC <style scoped> with the component. Import global CSS from src/main.ts (same file the source loaded).',
    ],
    antiPatterns: [
      'Do not convert an SFC into an empty template with a heading. Do not leave ReactDOM.createRoot or .tsx screens once .vue replacements exist.',
      'Do not change #app to #root (or the reverse) without updating both index.html and mount().',
    ],
  },
  angular: {
    contract: [
      'Standalone Angular (current CLI): src/main.ts calls bootstrapApplication(App, appConfig). app.config.ts uses provideRouter(routes).',
      'angular.json must exist and point browser to src/main.ts and styles to the global CSS file.',
    ],
    components: [
      'Prefer standalone @Component. @Input() / @Output() names are the public API — a route host must bind the same names, not "cleaner" aliases.',
      'Keep templates in the component templateUrl (or inline template). Do not dump a feature template into App.',
      'Services stay injectable or become plain modules; do not silently drop HTTP calls that lived in a service.',
    ],
    routing: [
      'Routes live in app.routes.ts. Each path loads the existing feature component. app.ts is a shell with <router-outlet />, not a reimplementation of home.',
    ],
    styling: [
      'Component styles stay in styleUrls. Global CSS is listed in angular.json styles (usually src/styles.css) — copy the source global stylesheet there.',
    ],
    antiPatterns: [
      'Do not leave vite.config / root index.html / #root as the real entry. ng serve will ignore them or conflict.',
      'Do not wrap a component in a new dummy component that remaps inputs (the same class of bug as renaming React callback props).',
    ],
  },
  svelte: {
    contract: [
      'Svelte 5 + Vite: src/main.ts uses mount(App, { target: document.getElementById("app") }). index.html has <div id="app">.',
      'vite.config.ts uses @sveltejs/vite-plugin-svelte. svelte.config.js uses vitePreprocess.',
    ],
    components: [
      'UI is .svelte files. Svelte 5 uses $props(), $state(), $derived, $effect. If the source is Svelte 4, map export let / let to $props / $state — keep the names.',
      'createEventDispatcher event names (or callback props in $props) are the public API. In React they become onX with the same X.',
    ],
    routing: [
      'This catalog targets a Vite SPA, not SvelteKit file routes. Use svelte-spa-router or a tiny custom map in App.svelte that renders existing screens. Do not invent +page.svelte Kit routes unless the source already was Kit.',
    ],
    styling: [
      'Keep <style> in the .svelte file that owned it. Import global CSS from src/main.ts.',
    ],
    antiPatterns: [
      'Do not emit an empty App.svelte that only says "Svelte app". Do not leave React/Vue mount code beside mount().',
      'Do not migrate a Vite SPA into SvelteKit folders unless the user target is explicitly a Kit app (it is not).',
    ],
  },
  nestjs: {
    contract: ['NestJS boots with NestFactory.create() and a root @Module.'],
    components: ['@Module, @Controller, @Injectable must stay wired: controllers, providers, and imports together.'],
    routing: ['HTTP routes are controller methods. Preserve method, path, and status when mapping away from Nest.'],
    styling: [],
    antiPatterns: ['Do not leave an empty AppModule that imports nothing the old module imported.'],
  },
  express: {
    contract: ['Express apps compose Router instances and a listen() (or exported app) entry.'],
    components: ['Convert Nest/Fastify plugins into routers or middleware functions; pass dependencies explicitly.'],
    routing: ['Preserve path + method on each route.'],
    styling: [],
    antiPatterns: [],
  },
  fastify: {
    contract: ['Fastify apps register plugins and route options.'],
    components: ['Preserve schema validation when mapping to/from Express or Nest.'],
    routing: ['Preserve path + method on each route.'],
    styling: [],
    antiPatterns: [],
  },
};

export function rulesForFramework(id: string): string[] {
  const pack = FRAMEWORK_PACKS[id.toLowerCase()];
  if (!pack) return [];
  return [...pack.contract, ...pack.components, ...pack.routing, ...pack.styling, ...pack.antiPatterns];
}

export function packForFramework(id: string): FrameworkPack | undefined {
  return FRAMEWORK_PACKS[id.toLowerCase()];
}

/** @deprecated Use FRAMEWORK_PACKS. Kept so older imports still typecheck. */
export const FRAMEWORK_RULES: Record<string, string[]> = Object.fromEntries(
  Object.entries(FRAMEWORK_PACKS).map(([id, pack]) => [id, rulesForFramework(id)]),
);
