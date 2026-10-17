import type { FrameworkPack } from './types';

export const angularPack: FrameworkPack = {
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
};
