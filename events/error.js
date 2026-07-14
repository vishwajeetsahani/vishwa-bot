/**
 * error.js
 * -----------------------------------------------------------------------
 * Catches internal Discord.js client errors (e.g. WebSocket issues) so
 * they're logged cleanly instead of potentially crashing the process.
 * -----------------------------------------------------------------------
 */

module.exports = {
  name: 'error',
  /**
   * @param {Error} error
   */
  execute(error) {
    console.error('[Client Error]', error);
  }
};
