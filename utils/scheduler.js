/**
 * scheduler.js
 * -----------------------------------------------------------------------
 * Internal Job Scheduler Module (Vishwa Bot v2.0)
 *
 * Implements a robust internal cron scheduling wrapper using standard
 * Node.js timeout intervals. Supports task creation, deletion, and status.
 * -----------------------------------------------------------------------
 */

class Scheduler {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Schedules a recurring job.
   * @param {string} name unique key identifying the task
   * @param {number} intervalMs frequency in milliseconds
   * @param {Function} callback function task logic
   * @param {boolean} runImmediately runs the task immediately on registration
   */
  schedule(name, intervalMs, callback, runImmediately = false) {
    if (this.jobs.has(name)) {
      this.cancel(name);
    }

    if (runImmediately) {
      try {
        callback();
      } catch (err) {
        console.error(`[Scheduler] Immediate execution error in job "${name}":`, err.message);
      }
    }

    const intervalId = setInterval(() => {
      try {
        callback();
      } catch (err) {
        console.error(`[Scheduler] Execution error in job "${name}":`, err.message);
        // Report to centralized error manager if registered
        const container = require('./container');
        if (container.has('errors')) {
          container.resolve('errors').log(err, `scheduler:${name}`);
        }
      }
    }, intervalMs);

    this.jobs.set(name, {
      intervalId,
      intervalMs,
      createdAt: new Date().toISOString()
    });
    console.log(`[Scheduler] Registered job "${name}" running every ${intervalMs}ms.`);
  }

  /**
   * Cancels an active job.
   * @param {string} name 
   * @returns {boolean} true if a job was cancelled
   */
  cancel(name) {
    const job = this.jobs.get(name);
    if (!job) return false;

    clearInterval(job.intervalId);
    this.jobs.delete(name);
    console.log(`[Scheduler] Cancelled job "${name}".`);
    return true;
  }

  /**
   * Checks if a job key is active.
   * @param {string} name 
   * @returns {boolean}
   */
  isActive(name) {
    return this.jobs.has(name);
  }

  /**
   * Returns list of currently active jobs.
   */
  list() {
    return Array.from(this.jobs.entries()).map(([name, detail]) => ({
      name,
      intervalMs: detail.intervalMs,
      createdAt: detail.createdAt
    }));
  }

  /**
   * Stops all active intervals.
   */
  shutdown() {
    for (const name of this.jobs.keys()) {
      this.cancel(name);
    }
  }
}

module.exports = new Scheduler();
