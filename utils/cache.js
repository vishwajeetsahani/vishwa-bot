/**
 * cache.js
 * -----------------------------------------------------------------------
 * Centralized Cache Layer (Vishwa Bot v2.0)
 *
 * Generic in-memory cache system supporting Time-To-Live (TTL) expiration,
 * statistics metrics, and automated invalidation sweeps.
 * -----------------------------------------------------------------------
 */

class CacheLayer {
  constructor() {
    this.store = new Map();
    this.hitCount = 0;
    this.missCount = 0;

    // Periodic sweep loop to delete expired keys (every 2 minutes)
    this.sweepInterval = setInterval(() => this.sweep(), 2 * 60 * 1000).unref();
  }

  /**
   * Stores a key-value pair in cache.
   * @param {string} key 
   * @param {any} value 
   * @param {number} ttlMs expiration lifetime in ms (0 = permanent)
   */
  set(key, value, ttlMs = 0) {
    const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : 0;
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Retrieves an item from cache.
   * Invalidates and returns null if the key has expired.
   * @param {string} key 
   * @returns {any|null}
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.missCount++;
      return null;
    }

    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return entry.value;
  }

  /**
   * Deletes a key from cache.
   * @param {string} key 
   * @returns {boolean}
   */
  delete(key) {
    return this.store.delete(key);
  }

  /**
   * Clears the entire store.
   */
  clear() {
    this.store.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Calculates current hit ratio.
   * @returns {number}
   */
  getHitRatio() {
    const total = this.hitCount + this.missCount;
    return total === 0 ? 0 : this.hitCount / total;
  }

  /**
   * Purges expired cache entries to free memory.
   */
  sweep() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt > 0 && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Shuts down sweep timers.
   */
  shutdown() {
    clearInterval(this.sweepInterval);
  }
}

module.exports = new CacheLayer();
