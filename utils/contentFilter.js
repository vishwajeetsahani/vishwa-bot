/**
 * contentFilter.js
 * -----------------------------------------------------------------------
 * Regex-based detection for links and Discord invite links, used by the
 * Anti-Link and Anti-Invite systems.
 * -----------------------------------------------------------------------
 */

// Matches discord.gg/xxx, discord.com/invite/xxx, discordapp.com/invite/xxx
const DISCORD_INVITE_REGEX = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9-]+/i;

// General URL matcher (http/https/www links)
const GENERAL_LINK_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+\.[a-z]{2,})/i;

/**
 * Checks if a message contains a Discord invite link.
 * @param {string} content
 * @returns {boolean}
 */
function containsDiscordInvite(content) {
  return DISCORD_INVITE_REGEX.test(content);
}

/**
 * Checks if a message contains any general link (http/https/www).
 * Note: this will also match Discord invites, since they're URLs too —
 * the messageCreate event checks invite status separately for distinct
 * logging/messaging.
 * @param {string} content
 * @returns {boolean}
 */
function containsLink(content) {
  return GENERAL_LINK_REGEX.test(content);
}

module.exports = { containsDiscordInvite, containsLink };
