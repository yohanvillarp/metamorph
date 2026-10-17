import type { FrameworkPack } from './types';

export const sveltePack: FrameworkPack = {
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
};
