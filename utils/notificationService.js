/**
 * notificationService.js
 * -----------------------------------------------------------------------
 * Notification Dispatcher Module (Vishwa Bot v2.0)
 *
 * Manages outgoing announcements and alerts for YouTube, RSS feed, and
 * broadcast messages. Infrastructure implementation only.
 * -----------------------------------------------------------------------
 */

class NotificationService {
  constructor() {
    this.announcementsCount = 0;
  }

  /**
   * Publishes alert to a guild channel.
   * @param {import('discord.js').TextChannel} channel 
   * @param {string|object} content 
   */
  async send(channel, content) {
    if (!channel || typeof channel.send !== 'function') {
      console.warn('[NotificationService] Invalid target channel provided.');
      return null;
    }
    
    this.announcementsCount++;
    return channel.send(content);
  }

  /**
   * Dispatches trigger alert checks.
   * @param {string} sourceName (e.g. YouTube feed URL, RSS stream)
   * @param {object} payload data payload
   */
  dispatchFeedUpdate(sourceName, payload) {
    console.log(`[NotificationService] Dispatching notification update from feed "${sourceName}".`);
    const container = require('./container');
    if (container.has('eventBus')) {
      container.resolve('eventBus').publish('feed:update', { source: sourceName, payload });
    }
  }
}

module.exports = new NotificationService();
