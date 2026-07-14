const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const container = require('../../../utils/container');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription("View your coin balance and leveling progress.")
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to view the balance for')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const guildId = interaction.guild.id;
      const userId = targetUser.id;

      if (!container.has('economy')) {
        throw new Error('Economy service is not registered in the container.');
      }
      const economyService = container.resolve('economy');

      // Automatically create account if it does not exist
      economyService.createAccount(guildId, userId);

      // Get cash coins from wallet
      const walletCoins = economyService.getBalance(guildId, userId);
      
      // Get bank coins directly from economy table
      const db = require('../../../utils/database');
      const eco = db.economy.get(guildId, userId);
      const bankCoins = eco ? eco.bank : 0;

      // Get leveling status
      const progressInfo = economyService.getProgress(userId, guildId);
      const level = progressInfo.level;
      const xp = progressInfo.xp;
      const progressPercent = Math.round(progressInfo.progress * 100);

      // Build professional embed
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('💰 Balance Profile')
        .setDescription(`Showing economy & level status for ${targetUser}`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 User', value: `${targetUser.tag}`, inline: true },
          { name: '💰 Wallet', value: `\`${walletCoins.toLocaleString()} coins\``, inline: true },
          { name: '🏦 Bank', value: `\`${bankCoins.toLocaleString()} coins\``, inline: true },
          { name: '⭐ Level', value: `\`Level ${level}\``, inline: true },
          { name: '✨ XP', value: `\`${xp.toLocaleString()} XP\``, inline: true },
          { name: '📈 Progress %', value: `\`${progressPercent}% to next level\``, inline: true },
          { name: '🏆 Server Rank', value: '`#1 (Rankings pending)`', inline: true }
        )
        .setFooter({ text: 'Economy System • Vishwa Bot' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      let errorId;
      if (container.has('errors')) {
        errorId = container.resolve('errors').log(error, 'command:balance');
      } else {
        console.error('[Balance Command] Error executing command:', error);
      }

      const replyContent = `❌ There was an error executing this command.${errorId ? ` Reference ID: \`${errorId}\`` : ''}`;
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: replyContent, ephemeral: true });
      } else {
        await interaction.reply({ content: replyContent, ephemeral: true });
      }
    }
  }
};
