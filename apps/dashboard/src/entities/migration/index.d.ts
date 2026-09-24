export declare const FRAMEWORKS: {
    value: string;
    label: string;
    group: string;
    icon: string;
}[];
export type Tab = 'overview' | 'swarm' | 'queue' | 'events';
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
    category: string;
    variant: string;
    bundler: string;
    packageManager: string;
    language: 'typescript' | 'javascript';
    hasTsConfig: boolean;
    pathAliases: Record<string, string[]>;
    monorepo?: MonorepoContext;
    confidence: number;
    evidence: string[];
    subsumedDependencies: string[];
    suggestedTargets: string[];
}
export interface DetectedTech {
    framework: string;
    confidence: number;
    evidence: string[];
    profile?: ProjectProfile;
}
export interface MigrationPlan {
    id: string;
    sourceFramework: string;
    targetFramework: string;
    targetPath: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    totalFiles: number;
    migratedFiles: number;
    createdAt: string;
    tasks: any[];
}
