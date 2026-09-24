export type ArchitectureCategory =
  | 'frontend-spa'
  | 'frontend-meta'
  | 'backend-api'
  | 'fullstack'
  | 'library';

export type RouterVariant =
  | 'next-app-router'
  | 'next-pages-router'
  | 'sveltekit'
  | 'vue-router'
  | 'react-router'
  | 'angular-router'
  | 'none';

export type BundlerType =
  | 'vite'
  | 'webpack'
  | 'turbopack'
  | 'angular-cli'
  | 'esbuild'
  | 'rollup'
  | 'unknown';

export type PackageManagerType = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface WorkspacePackage {
  name: string;
  relativePath: string;
  absolutePath: string;
  detectedFramework?: string;
}

export interface MonorepoContext {
  isMonorepo: boolean;
  tool?: 'turbo' | 'pnpm' | 'npm' | 'yarn' | 'nx' | 'lerna';
  packages: WorkspacePackage[];
  rootPath: string;
}

export interface ProjectProfile {
  framework: string;
  category: ArchitectureCategory;
  variant: RouterVariant;
  bundler: BundlerType;
  packageManager: PackageManagerType;
  language: 'typescript' | 'javascript';
  hasTsConfig: boolean;
  pathAliases: Record<string, string[]>;
  monorepo?: MonorepoContext;
  confidence: number; // 0 - 100
  evidence: string[];
  subsumedDependencies: string[];
  suggestedTargets: string[];
}

export interface DetectedTechnologyLegacy {
  framework: string;
  confidence: number;
  evidence: string[];
  profile?: ProjectProfile;
}
