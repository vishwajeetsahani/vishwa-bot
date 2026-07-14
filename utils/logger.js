/**
 * logger.js
 * -----------------------------------------------------------------------
 * Handles sending formatted log embeds to a guild's configured log
 * channel (set via !setup-logs #channel). Used by the moderation
 * commands and automod systems to keep a paper trail of all actions.
 *
 * If no log channel is configured, or the bot lacks permission to send
 * messages there, this fails silently (logged to console) so it never
 * breaks the primary command/action being performed.
 * -----------------------------------------------------------------------
 */

const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('./database');

// Color scheme for different log types — keeps logs visually scannable
const COLORS = {
  warn: 0xFFA500,    // orange
  kick: 0xFF8C00,    // dark orange
  ban: 0xFF0000,     // red
  timeout: 0xFFD700, // gold
  untimeout: 0x00BFFF, // deep sky blue
  clear: 0x808080,   // gray
  automod: 0x9B59B6, // purple
  info: 0x2ECC71,    // green
  member: 0x3498DB   // blue
};

/**
 * Sends a log embed to the guild's configured logging channel.
 *
 * @param {import('discord.js').Guild} guild
 * @param {object} options
 * @param {string} options.type - one of the COLORS keys, controls embed color
 * @param {string} options.title - embed title
 * @param {string} [options.description] - embed description/body
 * @param {Array<{name:string, value:string, inline?:boolean}>} [options.fields]
 * @param {import('discord.js').User} [options.user] - sets footer/avatar context
 */
async function sendLog(guild, { type = 'info', title, description, fields, user }) {
  try {
    const config = getGuildConfig(guild.id);
    if (!config.logChannel) return; // no log channel configured

    const channel = guild.channels.cache.get(config.logChannel);
    if (!channel || !channel.isTextBased()) return;

    // Confirm the bot can actually post here before attempting
    const perms = channel.permissionsFor(guild.members.me);
    if (!perms || !perms.has('SendMessages') || !perms.has('EmbedLinks')) {
      console.warn(`[Logger] Missing permissions to log in #${channel.name} (${guild.name})`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS[type] || COLORS.info)
      .setTitle(title)
      .setTimestamp();

    if (description) embed.setDescription(description);
    if (fields && fields.length) embed.addFields(fields);
    if (user) {
      embed.setFooter({ text: `User ID: ${user.id}`, iconURL: user.displayAvatarURL() });
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    // Logging should never crash the bot — just report to console
    console.error(`[Logger] Failed to send log in guild ${guild.id}:`, err.message);
  }
}

module.exports = { sendLog, COLORS };
