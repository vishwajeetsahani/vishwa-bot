/**
 * messageCreate.js
 * -----------------------------------------------------------------------
 * AutoMod Event Listener for Moderation Plugin (Vishwa Bot v2.0)
 *
 * Runs AutoMod checks (Anti-Link, Anti-Invite, Anti-Spam) on incoming
 * guild messages. Does not process prefix commands.
 * -----------------------------------------------------------------------
 */

const { configs } = require('../../../utils/database');
const { bypassesAutomod } = require('../../../utils/permissions');
const { containsDiscordInvite, containsLink } = require('../../../utils/contentFilter');
const { trackMessage } = require('../../../utils/spamTracker');
const { ModerationService } = require('../../../utils/moderationService');

const AUTOMOD_WARNING_LIFETIME = 5000;

module.exports = {
  name: 'messageCreate',

  async execute(message, client) {
    try {
      // Ignore bots, system messages, and direct messages
      if (message.author.bot || message.system || !message.guild) return;

      const config = configs.get(message.guild.id);
      const member = message.member;
      if (!member) return;

      const isExempt = bypassesAutomod(member);

      // ---------------------------------------------------------------
      // AUTOMOD: Anti-Invite
      // ---------------------------------------------------------------
      if (!isExempt && config.antiInvite && containsDiscordInvite(message.content)) {
        await handleViolation(message, 'Discord invite links are not allowed here.', 'invite');
        return; // Stopped further processing
      }

      // ---------------------------------------------------------------
      // AUTOMOD: Anti-Link
      // ---------------------------------------------------------------
      if (!isExempt && config.antiLink && containsLink(message.content)) {
        await handleViolation(message, 'Posting links is not allowed here.', 'link');
        return;
      }

      // ---------------------------------------------------------------
      // AUTOMOD: Anti-Spam
      // ---------------------------------------------------------------
      if (!isExempt && config.antiSpam) {
        const isSpamming = trackMessage(
          message.guild.id,
          message.author.id,
          config.spamThreshold,
          config.spamInterval
        );

        if (isSpamming) {
          await handleSpamViolation(message);
        }
      }
    } catch (err) {
      console.error('[AutoMod messageCreate] Unhandled error:', err);
    }
  }
};

/**
 * Deletes message, sends temporary in-channel alert, issues warn record in DB, and log.
 */
async function handleViolation(message, reason, type) {
  try {
    if (message.deletable) await message.delete();
  } catch (err) {
    console.error('[AutoMod] Failed to delete message:', err.message);
  }

  try {
    const warningMsg = await message.channel.send(`${message.author}, ${reason}`);
    setTimeout(() => warningMsg.delete().catch(() => {}), AUTOMOD_WARNING_LIFETIME);
  } catch (err) {
    console.error('[AutoMod] Failed to send warning alert:', err.message);
  }

  // Issue DB Warning through ModerationService
  try {
    const me = message.guild.members.me;
    await ModerationService.warn(message.guild, me, message.member, `AutoMod: ${reason}`);
  } catch (err) {
    console.error('[AutoMod] Failed to execute DB warning via ModerationService:', err.message);
  }
}

/**
 * Handles anti-spam triggers.
 */
async function handleSpamViolation(message) {
  try {
    if (message.deletable) await message.delete();
  } catch (err) {
    console.error('[AutoMod] Failed to delete spam message:', err.message);
  }

  try {
    const warningMsg = await message.channel.send(
      `${message.author}, please slow down — you're sending messages too quickly!`
    );
    setTimeout(() => warningMsg.delete().catch(() => {}), AUTOMOD_WARNING_LIFETIME);
  } catch (err) {
    console.error('[AutoMod] Failed to send spam warning alert:', err.message);
  }

  try {
    const me = message.guild.members.me;
    await ModerationService.warn(message.guild, me, message.member, 'AutoMod: Spamming messages');
  } catch (err) {
    console.error('[AutoMod] Failed to execute DB warning via ModerationService for spam:', err.message);
  }
}
