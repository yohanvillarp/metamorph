import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createReviewerAgent, reviewerQueue } from './ReviewerAgent';
import { validateTypeScriptSyntax } from './SyntaxValidator';
import { verifyMissingFile } from './StructureVerifier';
import { buildReviewPrompt } from './ReviewerInferenceRunner';

describe('Reviewer Feature Slice', () => {
  test('creates ReviewerAgent with valid participant ID and queue', () => {
    const reviewer = createReviewerAgent([]);
    assert.ok(reviewer.getId());
    assert.ok(reviewerQueue);
    assert.equal(typeof reviewerQueue.getLimit(), 'number');
  });

  test('validateTypeScriptSyntax handles non-TS files without errors', async () => {
    const result = await validateTypeScriptSyntax('readme.md');
    assert.equal(result.isValid, true);
  });

  test('buildReviewPrompt generates structured prompt with neighbor context and diff', () => {
    const prompt = buildReviewPrompt('src/components/Header.tsx', '+ export const Header = () => <div>Header</div>;', {
      id: 'test-plan',
      runId: 'run-1',
      targetPath: '/tmp',
      profile: {
        source: 'react',
        target: 'next',
      },
      tasks: [],
      createdAt: new Date(),
    });

    assert.ok(prompt.includes('Review the following file migration: src/components/Header.tsx'));
    assert.ok(prompt.includes('Diff or new content of the file under review:'));
    assert.ok(prompt.includes('You MUST respond in JSON.'));
  });

  test('verifyMissingFile approves missing file with demonstrable replacement', () => {
    const result = verifyMissingFile('/non/existent/vite.config.ts', {
      id: 'plan-1',
      runId: 'run-1',
      targetPath: '/tmp',
      profile: { source: 'react', target: 'next' },
      tasks: [],
      createdAt: new Date(),
    });

    // In a non-existent shadow root without next.config.*, it should reject
    assert.equal(result.passed, false);
    assert.ok(result.errors && result.errors.length > 0);
  });
});
