/**
 * metrics.js
 * -----------------------------------------------------------------------
 * Metrics Tracker Module (Vishwa Bot v2.0)
 *
 * Collects runtime performance markers: command latency execution times,
 * SQL queries count, plugin load logs, cache checks, and memory details.
 * -----------------------------------------------------------------------
 */

class MetricsTracker {
  constructor() {
    this.commandExecutions = [];
    this.queryCount = 0;
    this.pluginLoadTimes = new Map();
  }

  /**
   * Tracks command execution time.
   * @param {string} commandName 
   * @param {number} durationMs 
   */
  trackCommand(commandName, durationMs) {
    this.commandExecutions.push({
      commandName,
      durationMs,
      timestamp: Date.now()
    });
    
    // Cap in-memory history log size to 1000 items
    if (this.commandExecutions.length > 1000) {
      this.commandExecutions.shift();
    }
  }

  /**
   * Increments database query counter.
   */
  incrementQueries() {
    this.queryCount++;
  }

  /**
   * Sets the load time duration for a specific plugin.
   * @param {string} pluginName 
   * @param {number} durationMs 
   */
  trackPluginLoad(pluginName, durationMs) {
    this.pluginLoadTimes.set(pluginName, durationMs);
  }

  /**
   * Generates a performance report summary.
   * @returns {object}
   */
  getReport() {
    const container = require('./container');
    let cacheHitRatio = 0;
    if (container.has('cache')) {
      cacheHitRatio = container.resolve('cache').getHitRatio();
    }

    return {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      dbQueriesCount: this.queryCount,
      cacheHitRatio: Number(cacheHitRatio.toFixed(4)),
      pluginLoadTimes: Object.fromEntries(this.pluginLoadTimes),
      recentCommandLatencies: this.commandExecutions.slice(-10)
    };
  }
}

module.exports = new MetricsTracker();
