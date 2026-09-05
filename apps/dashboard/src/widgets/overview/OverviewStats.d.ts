interface OverviewStatsProps {
    pendingTasks: number;
    inProgressTasks: number;
    completedTasks: number;
    failedTasks: number;
    chartData: any[];
}
export declare const OverviewStats: ({ pendingTasks, inProgressTasks, completedTasks, failedTasks, chartData }: OverviewStatsProps) => import("react").JSX.Element;
export {};
