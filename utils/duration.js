/**
 * duration.js
 * -----------------------------------------------------------------------
 * Parses human-friendly duration strings (e.g. "10m", "1h", "2d") into
 * milliseconds, for use with the timeout command. Discord's timeout
 * feature has a hard cap of 28 days, which we enforce here too.
 * -----------------------------------------------------------------------
 */

const UNIT_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
};

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // Discord's hard limit

/**
 * Parses a duration string like "10m", "2h", "1d", "30s" into milliseconds.
 * @param {string} input
 * @returns {number|null} milliseconds, or null if invalid/out of range
 */
function parseDuration(input) {
  if (!input || typeof input !== 'string') return null;

  const match = input.trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (isNaN(amount) || amount <= 0) return null;

  const ms = amount * UNIT_MS[unit];
  if (ms > MAX_TIMEOUT_MS) return null;

  return ms;
}

/** Converts milliseconds back into a readable string, e.g. "1h 30m". */
function formatDuration(ms) {
  const days = Math.floor(ms / UNIT_MS.d);
  const hours = Math.floor((ms % UNIT_MS.d) / UNIT_MS.h);
  const minutes = Math.floor((ms % UNIT_MS.h) / UNIT_MS.m);
  const seconds = Math.floor((ms % UNIT_MS.m) / UNIT_MS.s);

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds) parts.push(`${seconds}s`);

  return parts.length ? parts.join(' ') : '0s';
}

module.exports = { parseDuration, formatDuration, MAX_TIMEOUT_MS };
