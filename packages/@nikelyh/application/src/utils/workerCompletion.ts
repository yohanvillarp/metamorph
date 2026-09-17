export type WorkerCompletionKind = 'migrated' | 'failed_missing';

export const MISSING_AFTER_WORKER = 'File missing after worker inference (missing_after_worker)';

/**
 * Decides the bus event after a Worker inference loop.
 * A missing path must never travel as FILE_MIGRATED.
 */
export function workerCompletionKind(fileExists: boolean): WorkerCompletionKind {
  return fileExists ? 'migrated' : 'failed_missing';
}
