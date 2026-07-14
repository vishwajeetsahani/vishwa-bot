const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const container = require('../../../utils/container');
const db = require('../../../utils/database');
const imageService = require('../../../utils/imageService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription("View your detailed economy profile card.")
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to view the profile for')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    // Generate profile card can take a bit (100-300ms) to load avatar over HTTP.
    // Defer the reply to avoid interaction time outs.
    await interaction.deferReply();

    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const guildId = interaction.guild.id;
      const userId = targetUser.id;

      if (!container.has('economy')) {
        throw new Error('Economy service is not registered in the container.');
      }
      const economyService = container.resolve('economy');

      // Automatically create account if missing
      economyService.createAccount(guildId, userId);

      // Get stats
      const walletCoins = economyService.getBalance(guildId, userId);
      const eco = db.economy.get(guildId, userId);
      const bankCoins = eco ? eco.bank : 0;
      const streak = eco ? eco.current_streak : 0;

      const progressInfo = economyService.getProgress(userId, guildId);
      const level = progressInfo.level;
      const xp = progressInfo.xp;
      const requiredXp = economyService.calculateRequiredXP(level + 1);

      // Calculate server rank dynamically
      const rank = db.levels.getRank(guildId, userId);

      // Prepare profile data payload
      const profileData = {
        wallet: walletCoins,
        bank: bankCoins,
        level,
        xp,
        requiredXp,
        progress: progressInfo.progress,
        streak,
        rank
      };

      // Generate card PNG buffer
      const buffer = await imageService.generateProfileCard(targetUser, interaction.guild, profileData);
      
      const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });

      // Reply with attachment. No embeds. The image is the response.
      await interaction.editReply({ files: [attachment] });
    } catch (error) {
      let errorId;
      if (container.has('errors')) {
        errorId = container.resolve('errors').log(error, 'command:profile');
      } else {
        console.error('[Profile Command] Error executing command:', error);
      }

      const replyContent = `❌ There was an error executing this command.${errorId ? ` Reference ID: \`${errorId}\`` : ''}`;
      
      // If deferred, edit the deferred reply. Otherwise send followUp/reply
      try {
        await interaction.editReply({ content: replyContent });
      } catch {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: replyContent, ephemeral: true });
        } else {
          await interaction.reply({ content: replyContent, ephemeral: true });
        }
      }
    }
  }
};
