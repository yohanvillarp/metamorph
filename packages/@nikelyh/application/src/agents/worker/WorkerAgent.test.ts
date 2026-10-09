import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerAgent, workerQueue } from './WorkerAgent';
import { buildWorkOnFilePrompt, buildFixRejectedPrompt } from './WorkerPromptBuilder';

describe('Worker Feature Slice', () => {
  test('creates WorkerAgent with valid participant ID and queue', () => {
    const worker = createWorkerAgent([]);
    assert.ok(worker.getId());
    assert.ok(workerQueue);
    assert.equal(typeof workerQueue.getLimit(), 'number');
  });

  test('WorkerPromptBuilder generates complete migration prompts', () => {
    const prompt = buildWorkOnFilePrompt('/tmp/src/App.tsx', {
      id: 'test-plan',
      runId: 'run-1',
      targetPath: '/tmp',
      profile: {
        source: 'react',
        target: 'next',
        rules: ['preserve test logic'],
      },
      tasks: [{ filePath: '/tmp/src/App.tsx', status: 'pending' }],
      createdAt: new Date(),
    });

    assert.ok(prompt.includes('You need to migrate the file at path: /tmp/src/App.tsx'));
    assert.ok(prompt.includes('Transform from react to next'));
    assert.ok(prompt.includes('Specific User Rules: preserve test logic'));
  });

  test('WorkerPromptBuilder generates fix rejected prompt with error feedback', () => {
    const prompt = buildFixRejectedPrompt({
      filePath: '/tmp/src/App.tsx',
      errors: ['TS2304: Cannot find name React'],
      source: 'reviewer',
      plan: null,
    });

    assert.ok(prompt.includes('You need to FIX the file at path: /tmp/src/App.tsx'));
    assert.ok(prompt.includes('TS2304: Cannot find name React'));
    assert.ok(prompt.includes('REJECTED by the Quality Assurance Reviewer'));
  });
});
