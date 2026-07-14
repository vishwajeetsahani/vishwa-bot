const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const container = require('../../../utils/container');
const { enforceEconomyManager } = require('../middleware');

/**
 * Helper to send economy logs to the configured channel.
 */
async function sendEconomyLog(guild, client, embed) {
  const db = container.resolve('db');
  const config = db.configs.get(guild.id);
  if (config && config.economyLogChannel) {
    const channel = await guild.channels.fetch(config.economyLogChannel).catch(() => null);
    if (channel) {
      await channel.send({ embeds: [embed] }).catch((err) => console.error('[PluginManager] Failed to send economy log to channel:', err));
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Manage user XP and level.')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add XP to a user.')
        .addUserOption(option => option.setName('user').setDescription('The target user').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('The amount of XP to add').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove XP from a user.')
        .addUserOption(option => option.setName('user').setDescription('The target user').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('The amount of XP to remove').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription("Set a user's XP.")
        .addUserOption(option => option.setName('user').setDescription('The target user').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('The XP amount to set').setRequired(true).setMinValue(0))
    )
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription("Reset a user's XP and Level.")
        .addUserOption(option => option.setName('user').setDescription('The target user').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands),
  modOnly: true,

  async execute(interaction, client) {
    // 1. Enforce permission middleware
    const hasPermission = await enforceEconomyManager(interaction);
    if (!hasPermission) return;

    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const guildId = interaction.guild.id;
    const moderatorId = interaction.user.id;

    const db = container.resolve('db');
    const economyService = container.resolve('economy');

    // Automatically create accounts
    economyService.createAccount(guildId, targetUser.id);
    economyService.createAccount(guildId, moderatorId);

    const previousValue = economyService.getProgress(targetUser.id, guildId).xp;
    let newValue = previousValue;

    if (subcommand === 'add') {
      const amount = interaction.options.getInteger('amount');
      const xpResult = economyService.addXP(targetUser.id, guildId, amount, 'ADMIN');
      newValue = xpResult.newXp;

      // Log to database
      db.economyLogs.create(guildId, moderatorId, targetUser.id, previousValue, newValue, 'XP_ADD', `Added ${amount} XP`);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⭐ XP Added')
        .setDescription(`Successfully added XP to ${targetUser}.`)
        .addFields(
          { name: '👤 Moderator', value: `<@${moderatorId}>`, inline: true },
          { name: '🎯 Target', value: `<@${targetUser.id}>`, inline: true },
          { name: '✨ XP Added', value: `\`${amount.toLocaleString()} XP\``, inline: true },
          { name: '📈 Old XP', value: `\`${previousValue.toLocaleString()} XP\``, inline: true },
          { name: '📉 New XP', value: `\`${newValue.toLocaleString()} XP\``, inline: true },
          { name: '⭐ New Level', value: `\`Level ${xpResult.newLevel}\``, inline: true }
        )
        .setTimestamp();

      await sendEconomyLog(interaction.guild, client, embed);
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'remove') {
      const amount = interaction.options.getInteger('amount');
      if (previousValue < amount) {
        return interaction.reply({
          content: `❌ Target user only has **${previousValue.toLocaleString()} XP**. Cannot remove **${amount.toLocaleString()} XP**.`,
          ephemeral: true
        });
      }
      const xpResult = economyService.removeXP(targetUser.id, guildId, amount, 'ADMIN');
      newValue = xpResult.newXp;

      // Log to database
      db.economyLogs.create(guildId, moderatorId, targetUser.id, previousValue, newValue, 'XP_REMOVE', `Removed ${amount} XP`);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⭐ XP Removed')
        .setDescription(`Successfully removed XP from ${targetUser}.`)
        .addFields(
          { name: '👤 Moderator', value: `<@${moderatorId}>`, inline: true },
          { name: '🎯 Target', value: `<@${targetUser.id}>`, inline: true },
          { name: '✨ XP Removed', value: `\`${amount.toLocaleString()} XP\``, inline: true },
          { name: '📈 Old XP', value: `\`${previousValue.toLocaleString()} XP\``, inline: true },
          { name: '📉 New XP', value: `\`${newValue.toLocaleString()} XP\``, inline: true },
          { name: '⭐ New Level', value: `\`Level ${xpResult.newLevel}\``, inline: true }
        )
        .setTimestamp();

      await sendEconomyLog(interaction.guild, client, embed);
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'set') {
      const amount = interaction.options.getInteger('amount');
      const newLevel = economyService.calculateLevel(amount);
      db.levels.updateXp(guildId, targetUser.id, amount, newLevel);
      newValue = amount;

      // Log to database
      db.economyLogs.create(guildId, moderatorId, targetUser.id, previousValue, newValue, 'XP_SET', `Set XP to ${amount}`);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⭐ XP Set')
        .setDescription(`Successfully set XP for ${targetUser}.`)
        .addFields(
          { name: '👤 Moderator', value: `<@${moderatorId}>`, inline: true },
          { name: '🎯 Target', value: `<@${targetUser.id}>`, inline: true },
          { name: '📈 Old XP', value: `\`${previousValue.toLocaleString()} XP\``, inline: true },
          { name: '📉 New XP', value: `\`${newValue.toLocaleString()} XP\``, inline: true },
          { name: '⭐ New Level', value: `\`Level ${newLevel}\``, inline: true }
        )
        .setTimestamp();

      await sendEconomyLog(interaction.guild, client, embed);
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'reset') {
      db.levels.updateXp(guildId, targetUser.id, 0, 1);
      newValue = 0;

      // Log to database
      db.economyLogs.create(guildId, moderatorId, targetUser.id, previousValue, newValue, 'XP_RESET', 'Reset XP and level');

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⭐ XP Reset')
        .setDescription(`Successfully reset XP and level for ${targetUser}.`)
        .addFields(
          { name: '👤 Moderator', value: `<@${moderatorId}>`, inline: true },
          { name: '🎯 Target', value: `<@${targetUser.id}>`, inline: true },
          { name: '📈 Previous XP', value: `\`${previousValue.toLocaleString()} XP\``, inline: true }
        )
        .setTimestamp();

      await sendEconomyLog(interaction.guild, client, embed);
      return interaction.reply({ embeds: [embed] });
    }
  }
};
