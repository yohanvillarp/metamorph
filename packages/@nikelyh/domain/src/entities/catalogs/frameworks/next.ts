import type { FrameworkPack } from './types';

export const nextPack: FrameworkPack = {
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
};
