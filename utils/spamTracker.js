/**
 * spamTracker.js
 * -----------------------------------------------------------------------
 * Tracks message frequency per-user, per-guild, in memory, to power the
 * Anti-Spam system. This intentionally does NOT use the JSON file
 * storage — spam tracking is high-frequency, ephemeral data that
 * doesn't need to survive a restart, and writing it to disk on every
 * message would be slow and wear unnecessarily on disk I/O (important
 * on constrained free hosting environments).
 *
 * Data shape (in memory only):
 * {
 *   "<guildId>-<userId>": {
 *     timestamps: [number, number, ...], // ms epoch of recent messages
 *     muted: boolean // prevents re-triggering while action is in progress
 *   }
 * }
 * -----------------------------------------------------------------------
 */

const trackerMap = new Map();

/**
 * Records a message from a user and returns whether they've exceeded
 * the spam threshold within the configured time interval.
 *
 * @param {string} guildId
 * @param {string} userId
 * @param {number} threshold - max messages allowed in the interval
 * @param {number} interval - time window in ms
 * @returns {boolean} true if the user just crossed the spam threshold
 */
function trackMessage(guildId, userId, threshold, interval) {
  const key = `${guildId}-${userId}`;
  const now = Date.now();

  let entry = trackerMap.get(key);
  if (!entry) {
    entry = { timestamps: [], muted: false };
    trackerMap.set(key, entry);
  }

  // Drop timestamps outside the current rolling window
  entry.timestamps = entry.timestamps.filter((t) => now - t < interval);
  entry.timestamps.push(now);

  if (entry.timestamps.length >= threshold && !entry.muted) {
    entry.muted = true; // prevent repeated triggers until reset
    // Auto-reset the "muted" debounce flag after the interval passes
    setTimeout(() => {
      const e = trackerMap.get(key);
      if (e) e.muted = false;
    }, interval);
    return true;
  }

  return false;
}

/** Clears tracked data for a user (e.g., after a moderation action). */
function resetUser(guildId, userId) {
  trackerMap.delete(`${guildId}-${userId}`);
}

// Periodic cleanup to prevent unbounded memory growth on long-running
// processes — purges entries that haven't been touched in 10 minutes.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of trackerMap.entries()) {
    const lastTimestamp = entry.timestamps[entry.timestamps.length - 1];
    if (!lastTimestamp || now - lastTimestamp > 10 * 60 * 1000) {
      trackerMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref(); // unref so this timer doesn't keep process alive unnecessarily

module.exports = { trackMessage, resetUser };
