import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ConcurrencyQueue } from './ConcurrencyQueue';

describe('ConcurrencyQueue', () => {
  test('respects the concurrency limit', async () => {
    const queue = new ConcurrencyQueue(2);
    let maxObservedActive = 0;
    let finishedCount = 0;

    const task = () => new Promise<void>((resolve) => {
      maxObservedActive = Math.max(maxObservedActive, queue.activeCount);
      setTimeout(() => {
        finishedCount++;
        resolve();
      }, 20);
    });

    await Promise.all([
      queue.enqueue(task),
      queue.enqueue(task),
      queue.enqueue(task),
      queue.enqueue(task),
    ]);

    // Wait until all drain
    while (finishedCount < 4) {
      await new Promise((r) => setTimeout(r, 10));
    }

    assert.equal(maxObservedActive, 2);
    assert.equal(finishedCount, 4);
    assert.equal(queue.activeCount, 0);
  });

  test('dynamically adjusts limit with setLimit', async () => {
    const queue = new ConcurrencyQueue(1);
    queue.setLimit(4);
    assert.equal(queue.getLimit(), 4);
  });
});
