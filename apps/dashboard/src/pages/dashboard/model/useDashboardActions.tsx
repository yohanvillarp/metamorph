import { useState } from 'react';
import type { MigrationPlan } from '@/entities/migration';
import { apiClient } from '@/shared/api/apiClient';
import { useAlertStore } from '@/shared/store/alertStore';
import { NextStepsViewer } from '../ui/NextStepsViewer';

export function useDashboardActions(
  latestPlan: MigrationPlan | null,
  onRefresh: () => Promise<void>,
  setAppliedRunId: (id: string | null) => void,
  setLastApply: (info: { gitUsed: boolean; branch?: string; message: string } | null) => void,
  onReset: () => Promise<void>
) {
  const [isApplying, setIsApplying] = useState(false);
  const { showAlert, showConfirm } = useAlertStore();

  const handleApplyMigration = async () => {
    if (!latestPlan) return;
    const pm = latestPlan.packageManager || 'npm';

    showConfirm(
      'Apply Migration?',
      <p>
        This will copy the migrated files from the shadow workspace into your project directory.
        Your original project has NOT been modified until this point. After applying, you will need to run{' '}
        <code className="font-mono bg-gray-200 px-1">{pm} install</code> to install the new dependencies.
      </p>,
      async () => {
        setIsApplying(true);
        try {
          const data = await apiClient.applyMigration(latestPlan.runId, latestPlan.targetPath);
          setAppliedRunId(latestPlan.runId);
          setLastApply({ gitUsed: data.gitUsed, branch: data.branch, message: data.message });
          await onRefresh();
          showAlert(
            'Applied',
            <NextStepsViewer
              message={data.message}
              gitUsed={data.gitUsed}
              branch={data.branch}
              targetPath={latestPlan.targetPath}
              packageManager={latestPlan.packageManager}
            />
          );
        } catch (err: unknown) {
          showAlert(
            'Apply Failed',
            <p className="text-red-500 font-bold">{err instanceof Error ? err.message : String(err)}</p>
          );
        } finally {
          setIsApplying(false);
        }
      }
    );
  };

  const handleDiscardMigration = async () => {
    if (!latestPlan) return;

    showConfirm(
      'Discard Migration?',
      <p>
        This will discard this run, delete its shadow workspace, and reset the migration state so you can start fresh. Are you sure?
      </p>,
      async () => {
        try {
          const res = await fetch('/api/migrations/rollback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ runId: latestPlan.runId }),
          });
          if (!res.ok) {
            console.warn('Rollback returned non-ok status, proceeding to reset state');
          }
        } catch (rollbackErr) {
          console.warn('Rollback request failed, proceeding to reset state', rollbackErr);
        } finally {
          try {
            await onReset();
            await onRefresh();
          } catch (resetErr) {
            showAlert(
              'Discard Failed',
              <p className="text-red-500 font-bold">{resetErr instanceof Error ? resetErr.message : String(resetErr)}</p>
            );
          }
        }
      }
    );
  };

  return {
    isApplying,
    handleApplyMigration,
    handleDiscardMigration,
  };
}
