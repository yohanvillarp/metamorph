import type { FrameworkPack } from './types';

export const vuePack: FrameworkPack = {
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
};
