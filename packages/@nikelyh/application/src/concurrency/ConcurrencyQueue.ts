/**
 * ConcurrencyQueue controls the bounded concurrent execution of asynchronous tasks
 * (such as LLM inference loops) to maintain rate limit compliance and prevent resource exhaustion.
 */
export class ConcurrencyQueue {
  private queue: Array<() => Promise<void>> = [];
  private currentActive = 0;
  private limit: number;

  constructor(concurrencyLimit = 3) {
    this.limit = Math.max(1, concurrencyLimit);
  }

  /**
   * Updates the concurrency limit dynamically.
   */
  setLimit(newLimit: number): void {
    this.limit = Math.max(1, newLimit);
    this.pump();
  }

  /**
   * Retrieves the current limit.
   */
  getLimit(): number {
    return this.limit;
  }

  /**
   * Retrieves the active in-flight count.
   */
  get activeCount(): number {
    return this.currentActive;
  }

  /**
   * Retrieves the number of queued pending tasks.
   */
  get pendingCount(): number {
    return this.queue.length;
  }

  /**
   * Enqueues an asynchronous task to run once concurrency slot is available.
   */
  async enqueue(task: () => Promise<void>): Promise<void> {
    this.queue.push(task);
    this.pump();
  }

  /**
   * Drains the queue respecting the concurrency limit.
   */
  private async pump(): Promise<void> {
    while (this.currentActive < this.limit && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      this.currentActive++;
      (async () => {
        try {
          await task();
        } catch (error) {
          console.error('[ConcurrencyQueue] Task execution error:', error);
        } finally {
          this.currentActive--;
          this.pump();
        }
      })();
    }
  }
}
