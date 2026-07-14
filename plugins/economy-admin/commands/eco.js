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
    .setName('eco')
    .setDescription('Manage user economy coins.')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add coins to a user.')
        .addUserOption(option => option.setName('user').setDescription('The target user').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('The amount of coins to add').setRequired(true).setMinValue(1))
        .addStringOption(option => option.setName('reason').setDescription('The reason for adding coins').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove coins from a user.')
        .addUserOption(option => option.setName('user').setDescription('The target user').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('The amount of coins to remove').setRequired(true).setMinValue(1))
        .addStringOption(option => option.setName('reason').setDescription('The reason for removing coins').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription("Set a user's wallet coins.")
        .addUserOption(option => option.setName('user').setDescription('The target user').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('The coin amount to set').setRequired(true).setMinValue(0))
        .addStringOption(option => option.setName('reason').setDescription('The reason for setting coins').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription("Reset a user's wallet and bank coins to 0.")
        .addUserOption(option => option.setName('user').setDescription('The target user').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('The reason for resetting coins').setRequired(false))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands),
  modOnly: true,

  async execute(interaction, client) {
    await interaction.deferReply({
      ephemeral: true
    });

    const originalReply = interaction.reply;
    interaction.reply = async (options) => {
      return await interaction.editReply(options);
    };

    try {
      // 1. Enforce permission middleware
      const hasPermission = await enforceEconomyManager(interaction);
      if (!hasPermission) return;

      const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const guildId = interaction.guild.id;
    const moderatorId = interaction.user.id;

    const db = container.resolve('db');
    const economyService = container.resolve('economy');

    // Automatically create accounts
    economyService.createAccount(guildId, targetUser.id);
    economyService.createAccount(guildId, moderatorId);

    const previousValue = economyService.getBalance(guildId, targetUser.id);
    let newValue = previousValue;

    if (subcommand === 'add') {
      const amount = interaction.options.getInteger('amount');
      newValue = economyService.addCoins(guildId, targetUser.id, amount, 'ADMIN', reason);

      // Log to database
      db.economyLogs.create(guildId, moderatorId, targetUser.id, previousValue, newValue, 'COINS_ADD', reason);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('💰 Coins Added')
        .setDescription(`Successfully added coins to ${targetUser}'s wallet.`)
        .addFields(
          { name: '👤 Moderator', value: `<@${moderatorId}>`, inline: true },
          { name: '🎯 Target', value: `<@${targetUser.id}>`, inline: true },
          { name: '💵 Amount Added', value: `\`${amount.toLocaleString()} coins\``, inline: true },
          { name: '📈 Old Balance', value: `\`${previousValue.toLocaleString()} coins\``, inline: true },
          { name: '📉 New Balance', value: `\`${newValue.toLocaleString()} coins\``, inline: true },
          { name: '📝 Reason', value: reason }
        )
        .setTimestamp();

      await sendEconomyLog(interaction.guild, client, embed);
      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'remove') {
      const amount = interaction.options.getInteger('amount');
      if (previousValue < amount) {
        return interaction.editReply({
          content: `❌ Target user only has **${previousValue.toLocaleString()} coins**. Cannot remove **${amount.toLocaleString()} coins**.`,
          ephemeral: true
        });
      }
      newValue = economyService.removeCoins(guildId, targetUser.id, amount, 'ADMIN', reason);

      // Log to database
      db.economyLogs.create(guildId, moderatorId, targetUser.id, previousValue, newValue, 'COINS_REMOVE', reason);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('💰 Coins Removed')
        .setDescription(`Successfully removed coins from ${targetUser}'s wallet.`)
        .addFields(
          { name: '👤 Moderator', value: `<@${moderatorId}>`, inline: true },
          { name: '🎯 Target', value: `<@${targetUser.id}>`, inline: true },
          { name: '💵 Amount Removed', value: `\`${amount.toLocaleString()} coins\``, inline: true },
          { name: '📈 Old Balance', value: `\`${previousValue.toLocaleString()} coins\``, inline: true },
          { name: '📉 New Balance', value: `\`${newValue.toLocaleString()} coins\``, inline: true },
          { name: '📝 Reason', value: reason }
        )
        .setTimestamp();

      await sendEconomyLog(interaction.guild, client, embed);
      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'set') {
      const amount = interaction.options.getInteger('amount');
      newValue = economyService.setCoins(guildId, targetUser.id, amount, 'ADMIN', reason);

      // Log to database
      db.economyLogs.create(guildId, moderatorId, targetUser.id, previousValue, newValue, 'COINS_SET', reason);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('💰 Coins Set')
        .setDescription(`Successfully set ${targetUser}'s wallet balance.`)
        .addFields(
          { name: '👤 Moderator', value: `<@${moderatorId}>`, inline: true },
          { name: '🎯 Target', value: `<@${targetUser.id}>`, inline: true },
          { name: '📈 Old Balance', value: `\`${previousValue.toLocaleString()} coins\``, inline: true },
          { name: '📉 New Balance', value: `\`${newValue.toLocaleString()} coins\``, inline: true },
          { name: '📝 Reason', value: reason }
        )
        .setTimestamp();

      await sendEconomyLog(interaction.guild, client, embed);
      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'reset') {
      // Get bank coins for accurate logs
      const eco = db.economy.get(guildId, targetUser.id);
      const bankCoins = eco ? eco.bank : 0;
      
      newValue = 0;
      economyService.setCoins(guildId, targetUser.id, 0, 'ADMIN', reason);
      db.economy.updateBank(guildId, targetUser.id, 0);

      // Log to database (combining wallet + bank previous value)
      db.economyLogs.create(guildId, moderatorId, targetUser.id, previousValue + bankCoins, 0, 'COINS_RESET', reason);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('💰 Coins Reset')
        .setDescription(`Successfully reset all wallet and bank coins for ${targetUser}.`)
        .addFields(
          { name: '👤 Moderator', value: `<@${moderatorId}>`, inline: true },
          { name: '🎯 Target', value: `<@${targetUser.id}>`, inline: true },
          { name: '📈 Previous Wallet', value: `\`${previousValue.toLocaleString()} coins\``, inline: true },
          { name: '🏦 Previous Bank', value: `\`${bankCoins.toLocaleString()} coins\``, inline: true },
          { name: '📝 Reason', value: reason }
        )
        .setTimestamp();

      await sendEconomyLog(interaction.guild, client, embed);
      return interaction.editReply({ embeds: [embed] });
    }
    } catch (error) {
      console.error(error);
      try {
        await interaction.editReply({
          content: '❌ An error occurred while executing this command.',
          ephemeral: true
        });
      } catch (err) {
        console.error('Failed to send error reply:', err);
      }
    } finally {
      interaction.reply = originalReply;
    }
  }
};
