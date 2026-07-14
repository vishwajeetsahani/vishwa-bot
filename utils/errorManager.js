/**
 * errorManager.js
 * -----------------------------------------------------------------------
 * Error Manager Module (Vishwa Bot v2.0)
 *
 * Centralizes exception catching and debugging output. Assigns unique Error
 * IDs, writes diagnostics dump reports, and manages process crashes.
 * -----------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');

class ErrorManager {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'data', 'errors');
    // Ensure logs directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Logs an exception, dumps crash diagnostics to data/errors, and returns Error ID.
   * @param {Error} error 
   * @param {string} context 
   * @returns {string} unique diagnostic reference code
   */
  log(error, context = 'global') {
    const errorId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const timestamp = new Date().toISOString();

    const diagnostics = {
      errorId,
      timestamp,
      context,
      name: error.name || 'Error',
      message: error.message || 'No message provided',
      stack: error.stack || 'No stack trace available',
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };

    try {
      const filePath = path.join(this.logDir, `crash_${errorId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(diagnostics, null, 2));
    } catch (writeErr) {
      console.error('[ErrorManager] Failed to write diagnostics file:', writeErr.message);
    }

    console.error(`[ErrorManager] [ID: ${errorId}] Error in context "${context}":`, error.message);
    return errorId;
  }
}

module.exports = new ErrorManager();
