import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { workerCompletionKind } from './workerCompletion';

describe('workerCompletionKind', () => {
  test('emits migrated when the path exists on disk', () => {
    assert.equal(workerCompletionKind(true), 'migrated');
  });

  test('emits failed_missing when the path does not exist', () => {
    assert.equal(workerCompletionKind(false), 'failed_missing');
  });
});
