/**
 * moderationService.js
 * -----------------------------------------------------------------------
 * Moderation Service (Vishwa Bot v2.0)
 *
 * Centralizes all business logic for moderation actions (ban, kick, warn,
 * timeout, clear). Enforces security, permissions, role hierarchy checks,
 * database logging, and Discord API execution.
 * -----------------------------------------------------------------------
 */

const { PermissionFlagsBits } = require('discord.js');
const { botHasPermission, botCanActOn, isHigherHierarchy, isBotOwner } = require('./permissions');
const { logs, warnings } = require('./database');
const { sendLog } = require('./logger');

class ModerationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModerationError';
  }
}

class ModerationService {
  /**
   * Enforces role hierarchy checks on invoker, target, and bot.
   */
  _enforceHierarchy(guild, invoker, target) {
    if (invoker.id === target.id) {
      throw new ModerationError('🚫 You cannot moderate yourself.');
    }

    if (guild.ownerId === target.id) {
      throw new ModerationError('🚫 You cannot moderate the server owner.');
    }

    // Role Hierarchy: Invoker vs Target
    if (!isHigherHierarchy(invoker, target)) {
      throw new ModerationError('🚫 You cannot moderate this member — they have an equal or higher role than you.');
    }

    // Role Hierarchy: Bot vs Target
    if (!botCanActOn(guild, target)) {
      throw new ModerationError('🚫 I cannot moderate this member — their role is equal to or higher than mine.');
    }
  }

  /**
   * Bans a user (member or external user ID).
   */
  async ban(guild, invoker, targetUser, reason) {
    // 1. Check Bot Permissions
    if (!botHasPermission(guild, PermissionFlagsBits.BanMembers)) {
      throw new ModerationError('🚫 I do not have the **Ban Members** permission.');
    }

    // 2. Fetch member if they are in the guild
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (targetMember) {
      this._enforceHierarchy(guild, invoker, targetMember);
    } else {
      // If user is not in guild, still prevent self and owner ban by user ID
      if (invoker.id === targetUser.id) {
        throw new ModerationError('🚫 You cannot ban yourself.');
      }
      if (guild.ownerId === targetUser.id) {
        throw new ModerationError('🚫 You cannot ban the server owner.');
      }
      if (isBotOwner(targetUser.id) && !isBotOwner(invoker.id)) {
        throw new ModerationError('🚫 You cannot ban a bot owner.');
      }
    }

    // 3. Attempt to DM user before ban (best effort)
    if (targetMember) {
      await targetMember.send(`You have been banned from **${guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
    }

    // 4. Perform Discord API ban
    try {
      await guild.members.ban(targetUser.id, { reason: `${reason} | Moderator: ${invoker.user.tag}` });
    } catch (err) {
      console.error('[ModerationService] Ban API failed:', err.message);
      throw new ModerationError('❌ Failed to execute ban command via Discord API.');
    }

    // 5. DB Logging
    const logEntry = logs.add(guild.id, 'ban', invoker.id, targetUser.id, reason);

    // 6. Logger Channel Logging
    await sendLog(guild, {
      type: 'ban',
      title: '🔨 Member Banned',
      description: `**User:** ${targetUser.tag} (${targetUser.id})\n**Moderator:** ${invoker.user}\n**Reason:** ${reason}\n**Action ID:** \`${logEntry.logId}\``,
      user: targetUser
    });

    return logEntry;
  }

  /**
   * Kicks a member from the guild.
   */
  async kick(guild, invoker, targetMember, reason) {
    if (!botHasPermission(guild, PermissionFlagsBits.KickMembers)) {
      throw new ModerationError('🚫 I do not have the **Kick Members** permission.');
    }

    this._enforceHierarchy(guild, invoker, targetMember);

    // DM user
    await targetMember.send(`You have been kicked from **${guild.name}**.\n**Reason:** ${reason}`).catch(() => {});

    try {
      await targetMember.kick(`${reason} | Moderator: ${invoker.user.tag}`);
    } catch (err) {
      console.error('[ModerationService] Kick API failed:', err.message);
      throw new ModerationError('❌ Failed to execute kick command via Discord API.');
    }

    const logEntry = logs.add(guild.id, 'kick', invoker.id, targetMember.id, reason);

    await sendLog(guild, {
      type: 'kick',
      title: '👢 Member Kicked',
      description: `**User:** ${targetMember.user.tag} (${targetMember.id})\n**Moderator:** ${invoker.user}\n**Reason:** ${reason}\n**Action ID:** \`${logEntry.logId}\``,
      user: targetMember.user
    });

    return logEntry;
  }

  /**
   * Times out a member (native mute).
   */
  async timeout(guild, invoker, targetMember, durationMs, reason) {
    if (!botHasPermission(guild, PermissionFlagsBits.ModerateMembers)) {
      throw new ModerationError('🚫 I do not have the **Moderate Members** permission.');
    }

    this._enforceHierarchy(guild, invoker, targetMember);

    try {
      await targetMember.timeout(durationMs, `${reason} | Moderator: ${invoker.user.tag}`);
    } catch (err) {
      console.error('[ModerationService] Timeout API failed:', err.message);
      throw new ModerationError('❌ Failed to execute timeout command via Discord API.');
    }

    // DM user
    await targetMember.send(`You have been timed out in **${guild.name}**.\n**Reason:** ${reason}`).catch(() => {});

    const logEntry = logs.add(guild.id, 'timeout', invoker.id, targetMember.id, `Duration: ${durationMs}ms | Reason: ${reason}`);

    await sendLog(guild, {
      type: 'timeout',
      title: '🔇 Member Timed Out',
      description: `**User:** ${targetMember.user.tag} (${targetMember.id})\n**Moderator:** ${invoker.user}\n**Reason:** ${reason}\n**Action ID:** \`${logEntry.logId}\``,
      user: targetMember.user
    });

    return logEntry;
  }

  /**
   * Removes a timeout from a member.
   */
  async untimeout(guild, invoker, targetMember, reason) {
    if (!botHasPermission(guild, PermissionFlagsBits.ModerateMembers)) {
      throw new ModerationError('🚫 I do not have the **Moderate Members** permission.');
    }

    this._enforceHierarchy(guild, invoker, targetMember);

    if (!targetMember.isCommunicationDisabled || !targetMember.isCommunicationDisabled()) {
      throw new ModerationError(`ℹ️ ${targetMember.user.tag} is not currently timed out.`);
    }

    try {
      await targetMember.timeout(null, `Timeout removed by ${invoker.user.tag}`);
    } catch (err) {
      console.error('[ModerationService] Untimeout API failed:', err.message);
      throw new ModerationError('❌ Failed to execute untimeout command via Discord API.');
    }

    const logEntry = logs.add(guild.id, 'untimeout', invoker.id, targetMember.id, reason);

    await sendLog(guild, {
      type: 'untimeout',
      title: '🔊 Timeout Removed',
      description: `**User:** ${targetMember.user.tag} (${targetMember.id})\n**Moderator:** ${invoker.user}\n**Action ID:** \`${logEntry.logId}\``,
      user: targetMember.user
    });

    return logEntry;
  }

  /**
   * Issues a warning.
   */
  async warn(guild, invoker, targetMember, reason) {
    this._enforceHierarchy(guild, invoker, targetMember);

    if (targetMember.user.bot) {
      throw new ModerationError('🚫 You cannot warn a bot.');
    }

    // Write to warnings table
    const warnEntry = warnings.add(guild.id, targetMember.id, invoker.id, reason);

    // Record persistent action log
    const logEntry = logs.add(guild.id, 'warn', invoker.id, targetMember.id, reason);

    // DM user
    const totalWarnings = warnings.count(guild.id, targetMember.id);
    await targetMember.send(`You have been warned in **${guild.name}**.\n**Reason:** ${reason}\n**Total Warnings:** ${totalWarnings}`).catch(() => {});

    await sendLog(guild, {
      type: 'warn',
      title: '⚠️ Member Warned',
      description: `**User:** ${targetMember.user.tag} (${targetMember.id})\n**Moderator:** ${invoker.user}\n**Reason:** ${reason}\n**Warning ID:** \`${warnEntry.id}\`\n**Action ID:** \`${logEntry.logId}\``,
      user: targetMember.user
    });

    return { warnEntry, logEntry };
  }

  /**
   * Bulk-deletes messages from a channel.
   */
  async clear(channel, invoker, amount) {
    if (amount < 1 || amount > 100) {
      throw new ModerationError('⚠️ Please specify a number between **1** and **100**.');
    }

    if (!botHasPermission(channel.guild, PermissionFlagsBits.ManageMessages)) {
      throw new ModerationError('🚫 I do not have permission to manage messages. Please grant me the **Manage Messages** permission.');
    }

    // Reject messages older than 14 days
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const messages = await channel.messages.fetch({ limit: amount }).catch((err) => {
      console.error('[ModerationService] Clear message fetch failed:', err.message);
      throw new ModerationError('❌ Failed to fetch messages for age check.');
    });

    const hasOldMessages = messages.some(msg => msg.createdTimestamp < fourteenDaysAgo);
    if (hasOldMessages) {
      throw new ModerationError('⚠️ Cannot bulk-delete messages older than 14 days (Discord API limit).');
    }

    let deleted;
    try {
      deleted = await channel.bulkDelete(amount, true);
    } catch (err) {
      console.error('[ModerationService] Clear API failed:', err.message);
      throw new ModerationError('❌ Failed to execute bulk delete via Discord API.');
    }

    const logEntry = logs.add(channel.guild.id, 'clear', invoker.id, null, `Cleared ${deleted.size} messages in #${channel.name}`);

    await sendLog(channel.guild, {
      type: 'clear',
      title: '🧹 Messages Cleared',
      description: `**Channel:** ${channel}\n**Amount Requested:** ${amount}\n**Amount Deleted:** ${deleted.size}\n**Moderator:** ${invoker.user}\n**Action ID:** \`${logEntry.logId}\``,
      user: invoker.user
    });

    return { deletedCount: deleted.size, logEntry };
  }
}

module.exports = {
  ModerationService: new ModerationService(),
  ModerationError
};
