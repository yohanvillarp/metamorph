import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  findShadowRoot,
  hasNextAppRoutes,
  isFsdPageComponent,
  isSpaPagesTreeFile,
  isSpaRootComponent,
} from './NextMigrationHints';

export interface ClassifyMissingFileInput {
  filePath: string;
  source: string;
  target: string;
  shadowRoot?: string | null;
  fileExists?: (p: string) => boolean;
}

export interface ClassifyMissingFileResult {
  verdict: 'approved' | 'rejected';
  reason?: string;
  errors?: string[];
}

const NEXT_CONFIG_NAMES = [
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'next.config.cjs',
];

const CONFIG_FILE_PATTERN = /[/\\](vite\.config|craco\.config|webpack\.config)\.(js|ts|mjs|cjs)$/i;

/**
 * Classifies whether a missing file in the shadow workspace represents a valid,
 * demonstrable replacement/relocation, or an illegitimate deletion of application code.
 * 
 * Never auto-approves deletions unless demonstrable evidence of a replacement exists.
 */
export function classifyMissingFile(input: ClassifyMissingFileInput): ClassifyMissingFileResult {
  const { filePath, target } = input;
  const fileExists = input.fileExists || fs.existsSync;
  const shadowRoot = input.shadowRoot !== undefined ? input.shadowRoot : findShadowRoot(filePath);
  const normalizedTarget = target.toLowerCase();
  const normalizedPath = filePath.replace(/\\/g, '/');

  // 1. Build tool / Bundler Config Deletion
  if (CONFIG_FILE_PATTERN.test(filePath)) {
    if (normalizedTarget === 'next' && shadowRoot) {
      const hasNextConfig = NEXT_CONFIG_NAMES.some((cfg) =>
        fileExists(path.join(shadowRoot, cfg))
      );
      if (hasNextConfig) {
        return {
          verdict: 'approved',
          reason: `Config file removed because a Next.js configuration exists in shadow workspace.`,
        };
      }
      return {
        verdict: 'rejected',
        errors: [
          `Configuration file was removed, but no Next.js configuration (next.config.js/mjs/ts) was found in the project root.`,
        ],
      };
    }
  }

  // 2. index.html removal (SPA HTML shell)
  if (/[/\\]index\.html$/i.test(filePath)) {
    if (normalizedTarget === 'next' && shadowRoot) {
      const layoutCandidates = [
        path.join(shadowRoot, 'src', 'app', 'layout.tsx'),
        path.join(shadowRoot, 'src', 'app', 'layout.jsx'),
        path.join(shadowRoot, 'src', 'app', 'layout.js'),
        path.join(shadowRoot, 'app', 'layout.tsx'),
        path.join(shadowRoot, 'app', 'layout.jsx'),
        path.join(shadowRoot, 'app', 'layout.js'),
        path.join(shadowRoot, 'src', 'pages', '_document.tsx'),
        path.join(shadowRoot, 'pages', '_document.tsx'),
      ];
      const hasLayout = layoutCandidates.some((candidate) => fileExists(candidate));
      if (hasLayout) {
        return {
          verdict: 'approved',
          reason: `index.html was removed because Next.js root layout or _document exists.`,
        };
      }
      return {
        verdict: 'rejected',
        errors: [
          `index.html was removed, but no Next.js root layout (app/layout.tsx) or _document was created to provide the HTML structure.`,
        ],
      };
    }
  }

  // 3. SPA Root Component (App.tsx, main.tsx, index.tsx)
  if (isSpaRootComponent(filePath)) {
    if (normalizedTarget === 'next') {
      const hasRoutes = shadowRoot ? hasNextAppRoutes(shadowRoot) : false;
      if (hasRoutes) {
        return {
          verdict: 'approved',
          reason: `SPA root component was removed because Next.js App Router routes exist.`,
        };
      }
      return {
        verdict: 'rejected',
        errors: [
          `The SPA root was deleted before src/app/**/page.tsx existed with real UI. Recreate routing as Next App Router pages that import the original screen components. Do not import App from those pages.`,
        ],
      };
    }
  }

  // 4. SPA Page Components under src/pages
  if (isFsdPageComponent(filePath) || isSpaPagesTreeFile(filePath)) {
    if (normalizedTarget === 'next') {
      // Check if relocated to views, screens, or components
      const viewsReplacement = filePath.replace(/([/\\])src\1pages\1/, '$1src$1views$1');
      const screensReplacement = filePath.replace(/([/\\])src\1pages\1/, '$1src$1screens$1');
      const compReplacement = filePath.replace(/([/\\])src\1pages\1/, '$1src$1components$1pages$1');

      if (fileExists(viewsReplacement) || fileExists(screensReplacement) || fileExists(compReplacement)) {
        return {
          verdict: 'approved',
          reason: `File moved out of src/pages into a non-reserved directory for Next.js.`,
        };
      }

      return {
        verdict: 'rejected',
        errors: [
          `This file lived under src/pages as SPA UI. Next.js reserves src/pages for the Pages Router — move the tree to a non-reserved folder (e.g. src/views) and import those screens from src/app. Do not delete the UI without a replacement.`,
        ],
      };
    }
  }

  // 5. Default: Any other missing file without demonstrable successor is REJECTED
  const fileName = path.basename(filePath);
  return {
    verdict: 'rejected',
    errors: [
      `File "${fileName}" does not exist on disk and has no demonstrable replacement or migration successor. Code migrations must preserve UI or migrate to a target equivalent.`,
    ],
  };
}
