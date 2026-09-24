import type { PackageManagerType } from './ProjectProfile';

export interface PackageManagerCommands {
  name: PackageManagerType;
  install: string;
  cleanInstall: string;
  runBuild: string;
  runDev: string;
}

/**
 * Returns polymorphic CLI commands for dependency installation and execution.
 * Pure function conforming to Zero-I/O domain guidelines.
 */
export function resolvePackageManagerCommands(pm?: PackageManagerType): PackageManagerCommands {
  switch (pm) {
    case 'pnpm':
      return {
        name: 'pnpm',
        install: 'pnpm install',
        cleanInstall: 'pnpm install',
        runBuild: 'pnpm run build',
        runDev: 'pnpm dev',
      };
    case 'yarn':
      return {
        name: 'yarn',
        install: 'yarn install',
        cleanInstall: 'yarn install',
        runBuild: 'yarn build',
        runDev: 'yarn dev',
      };
    case 'bun':
      return {
        name: 'bun',
        install: 'bun install',
        cleanInstall: 'bun install',
        runBuild: 'bun run build',
        runDev: 'bun dev',
      };
    default:
      return {
        name: 'npm',
        install: 'npm install',
        cleanInstall: 'npm install --no-fund --no-audit',
        runBuild: 'npm run build',
        runDev: 'npm run dev',
      };
  }
}
