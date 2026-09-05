export declare const FRAMEWORKS: {
    value: string;
    label: string;
    group: string;
    icon: string;
}[];
export type Tab = 'overview' | 'swarm' | 'queue' | 'events';
export interface DetectedTech {
    framework: string;
    confidence: number;
    evidence: string[];
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
