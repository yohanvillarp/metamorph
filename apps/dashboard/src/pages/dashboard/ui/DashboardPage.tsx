import { useCostSummary } from '@/entities/cost';
import { EventLog } from '@/widgets/event-log/EventLog';
import { MigrationForm } from '@/widgets/migration-form/MigrationForm';
import { AgentRoster } from '@/widgets/overview/AgentRoster';
import { OverviewStats } from '@/widgets/overview/OverviewStats';
import { CostTracker } from '@/widgets/CostTracker';
import { MigrationQueue } from '@/widgets/queue/MigrationQueue';
import { LiveSwarm } from '@/widgets/swarm-view/LiveSwarm';
import { useDashboardState } from '../model/useDashboardState';
import { useDashboardActions } from '../model/useDashboardActions';
import { DashboardHeader } from './DashboardHeader';
import { DashboardStatusBanner } from './DashboardStatusBanner';
import { DashboardNav } from './DashboardNav';
import { ServerOfflineBanner } from './ServerOfflineBanner';

export const DashboardPage = () => {
  const state = useDashboardState();
  const { costSummary } = useCostSummary(state.latestPlan?.runId, !state.isFinished);
  const actions = useDashboardActions(
    state.latestPlan,
    state.fetchData,
    state.setAppliedRunId,
    state.setLastApply,
    state.handleResetMigration
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col min-h-screen">
      {state.isServerOffline && (
        <ServerOfflineBanner onRetry={state.fetchData} />
      )}
      {state.latestPlan ? (
        <>
          <DashboardHeader
            latestPlan={state.latestPlan}
            isFinished={state.isFinished}
            isApplied={state.isApplied}
            canApply={state.canApply}
            isApplying={actions.isApplying}
            onApply={actions.handleApplyMigration}
            onDiscard={actions.handleDiscardMigration}
            onReset={state.handleResetMigration}
          />

          <DashboardStatusBanner
            latestPlan={state.latestPlan}
            isFinished={state.isFinished}
            isApplied={state.isApplied}
            isFailed={state.isFailed}
            isIntegrating={state.isIntegrating}
            latestStatusMessage={state.latestStatusMessage}
            lastApplyBranch={state.lastApply?.branch}
            isStalled={state.isStalled}
            stalledDurationSeconds={state.stalledDurationSeconds}
            onDiscard={actions.handleDiscardMigration}
          />

          <DashboardNav activeTab={state.activeTab} onSelectTab={state.selectTab} />

          <main className="flex-1 mt-6">
            {state.activeTab === 'overview' && (
              <div className="space-y-8">
                <CostTracker costSummary={costSummary} totalFiles={state.latestPlan.tasks?.length || 0} />
                <AgentRoster counts={state.agentCounts} activeAgent={state.activeAgent} disabledAgents={state.disabledAgents} />
                <OverviewStats
                  pendingTasks={state.pendingTasks}
                  inProgressTasks={state.inProgressTasks}
                  completedTasks={state.completedTasks}
                  failedTasks={state.failedTasks}
                  chartData={state.chartData}
                  isIntegrating={state.isIntegrating}
                />
              </div>
            )}

            {state.activeTab === 'swarm' && (
              <LiveSwarm
                tasks={state.latestPlan.tasks}
                events={state.events}
                activeAgent={state.activeAgent}
                isIntegrating={state.isIntegrating}
                isFinished={state.isFinished}
                latestStatus={state.latestStatusMessage}
              />
            )}

            {state.activeTab === 'queue' && (
              <MigrationQueue
                tasks={state.latestPlan.tasks}
                phase={state.latestPlan.phase}
                outcome={state.latestPlan.outcome}
              />
            )}

            {state.activeTab === 'events' && <EventLog events={state.events} />}
          </main>
        </>
      ) : (
        <MigrationForm
          isStarting={state.isStarting}
          startError={state.startError}
          onStart={state.handleStartMigration}
        />
      )}
    </div>
  );
};
