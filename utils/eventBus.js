/**
 * eventBus.js
 * -----------------------------------------------------------------------
 * Event Bus Module (Vishwa Bot v2.0)
 *
 * Provides a centralized publish-subscribe system extending the native
 * Node.js EventEmitter. Used for asynchronous cross-plugin communication.
 * -----------------------------------------------------------------------
 */

const EventEmitter = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    // Increase default max listeners limit to prevent warnings on large installations
    this.setMaxListeners(100);
  }

  /**
   * Publishes an event asynchronously to all subscribers.
   * Logs activity and reports errors back to caller safely.
   * @param {string} eventName 
   * @param {any} payload 
   */
  publish(eventName, payload) {
    try {
      this.emit(eventName, payload);
      // Try to report to metrics tracker if registered
      const container = require('./container');
      if (container.has('metrics')) {
        const metrics = container.resolve('metrics');
        metrics.incrementQueries(); // Treat event pub as a tracking metric tick
      }
    } catch (err) {
      console.error(`[EventBus] Error publishing event "${eventName}":`, err.message);
    }
  }

  /**
   * Subscribes to an event trigger.
   * @param {string} eventName 
   * @param {Function} listener 
   */
  subscribe(eventName, listener) {
    this.on(eventName, listener);
    return () => this.unsubscribe(eventName, listener);
  }

  /**
   * Unsubscribes a specific listener from an event trigger.
   * @param {string} eventName 
   * @param {Function} listener 
   */
  unsubscribe(eventName, listener) {
    this.off(eventName, listener);
  }
}

module.exports = new EventBus();
