/**
 * permissions.js
 * -----------------------------------------------------------------------
 * Centralized permission-checking utilities (Vishwa Bot v2.0)
 *
 * Implements:
 *   - process.env.OWNER_IDS loading and parsing
 *   - Strict invoker vs target role hierarchy validation
 *   - Bot permission checking
 *   - Bypass rules for server owner and bot owners
 * -----------------------------------------------------------------------
 */

const { PermissionsBitField } = require('discord.js');

// Parse owner IDs from .env
const OWNER_IDS = process.env.OWNER_IDS
  ? process.env.OWNER_IDS.split(',').map((id) => id.trim())
  : [];

/**
 * Checks if a user is a configured bot owner (in OWNER_IDS).
 * @param {string} userId
 * @returns {boolean}
 */
function isBotOwner(userId) {
  if (!userId) return false;
  return OWNER_IDS.includes(userId);
}

/**
 * Determines if a guild member should bypass automod systems
 * (anti-link, anti-invite, anti-spam).
 *
 * @param {import('discord.js').GuildMember} member
 * @returns {boolean} true if the member bypasses automod
 */
function bypassesAutomod(member) {
  if (!member || !member.guild) return false;

  // 1. Bot Owner bypass
  if (isBotOwner(member.id)) return true;

  // 2. Server Owner always bypasses
  if (member.guild.ownerId === member.id) return true;

  // 3. Administrators bypass
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;

  // 4. Moderators (Manage Messages) bypass
  if (member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return true;

  // Bots are generally exempt from automod to avoid breaking webhooks/other bots
  if (member.user?.bot) return true;

  return false;
}

/**
 * Determines if a member is allowed to run moderation commands.
 * Requires Manage Messages or higher, or being a Bot Owner / Server Owner.
 *
 * @param {import('discord.js').GuildMember} member
 * @returns {boolean}
 */
function isModerator(member) {
  if (!member) return false;
  if (isBotOwner(member.id)) return true;
  return bypassesAutomod(member) && !member.user?.bot;
}

/**
 * Checks whether the bot itself has a specific permission in a guild/channel.
 *
 * @param {import('discord.js').Guild} guild
 * @param {bigint} permissionFlag
 * @returns {boolean}
 */
function botHasPermission(guild, permissionFlag) {
  const me = guild.members.me;
  if (!me) return false;
  return me.permissions.has(permissionFlag);
}

/**
 * Checks if the bot's highest role is above the target member's highest role.
 *
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildMember} target
 * @returns {boolean} true if the bot CAN act on the target
 */
function botCanActOn(guild, target) {
  const me = guild.members.me;
  if (!me || !target) return false;
  
  // Owner can never be acted on by a bot
  if (guild.ownerId === target.id) return false;
  
  // Bot Owner can never be acted on by a bot
  if (isBotOwner(target.id)) return false;

  return me.roles.highest.position > target.roles.highest.position;
}

/**
 * Checks if the command invoker's hierarchy is strictly above the target member's.
 * Restricts moderators from acting on their superiors or equals.
 *
 * @param {import('discord.js').GuildMember} invoker
 * @param {import('discord.js').GuildMember} target
 * @returns {boolean} true if the invoker can act on the target
 */
function isHigherHierarchy(invoker, target) {
  if (!invoker || !target) return false;

  // Bot Owner has highest possible authority and bypasses all checks
  if (isBotOwner(invoker.id)) return true;

  // Server Owner bypasses all checks
  if (invoker.guild.ownerId === invoker.id) return true;

  // Nobody (other than a bot owner) can act on the Server Owner
  if (target.guild.ownerId === target.id) return false;

  // Nobody (other than a bot owner) can act on a Bot Owner
  if (isBotOwner(target.id)) return false;

  // Regular role position hierarchy check
  return invoker.roles.highest.position > target.roles.highest.position;
}

module.exports = {
  isBotOwner,
  bypassesAutomod,
  isModerator,
  botHasPermission,
  botCanActOn,
  isHigherHierarchy
};
