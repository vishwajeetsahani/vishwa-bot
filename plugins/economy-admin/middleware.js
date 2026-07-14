const { PermissionsBitField } = require('discord.js');
const container = require('../../utils/container');
const { isBotOwner } = require('../../utils/permissions');

/**
 * Enforces permissions for Economy Admin commands.
 * Checks for Bot Owner, Server Owner, Administrator, or configured Economy Manager role.
 * Automatically replies ephemerally if permission is denied.
 * 
 * @param {import('discord.js').ChatInputCommandInteraction} interaction 
 * @returns {Promise<boolean>} true if allowed, false if denied
 */
async function enforceEconomyManager(interaction) {
  const member = interaction.member;
  const guild = interaction.guild;
  if (!member || !guild) return false;

  // 1. Bot Owner check
  if (isBotOwner(member.id)) return true;

  // 2. Guild Owner check
  if (guild.ownerId === member.id) return true;

  // 3. Administrator permission check
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;

  // 4. Configured Economy Manager role check
  const db = container.resolve('db');
  const config = db.configs.get(guild.id);
  if (config && config.economyManagerRole) {
    if (member.roles.cache.has(config.economyManagerRole)) {
      return true;
    }
  }

  await interaction.reply({
    content: '🚫 You do not have permission to use this command. (Requires Owner, Administrator, or configured Economy Manager role.)',
    ephemeral: true
  });
  return false;
}

/**
 * Enforces community channel restrictions.
 * If a Community Channel is configured, ensures the command is only executed there.
 * Automatically replies ephemerally if executed outside the configured channel.
 * 
 * @param {import('discord.js').ChatInputCommandInteraction} interaction 
 * @returns {Promise<boolean>} true if allowed, false if denied
 */
async function enforceCommunityChannel(interaction) {
  const guild = interaction.guild;
  if (!guild) return true;

  const db = container.resolve('db');
  const config = db.configs.get(guild.id);
  if (config && config.communityChannel) {
    if (interaction.channelId !== config.communityChannel) {
      await interaction.reply({
        content: `❌ This command can only be used inside the configured community channel: <#${config.communityChannel}>`,
        ephemeral: true
      });
      return false;
    }
  }

  return true;
}

module.exports = {
  enforceEconomyManager,
  enforceCommunityChannel
};
