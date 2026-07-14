const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const container = require('../../../utils/container');
const db = require('../../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily coin reward.'),

  async execute(interaction, client) {
    try {
      const guildId = interaction.guild.id;
      const userId = interaction.user.id;

      if (!container.has('economy')) {
        throw new Error('Economy service is not registered in the container.');
      }
      const economyService = container.resolve('economy');

      // Automatically create account if it does not exist
      economyService.createAccount(guildId, userId);

      const ecoRecord = db.economy.get(guildId, userId);
      const now = new Date();
      const lastClaimStr = ecoRecord.last_daily;

      let currentStreak = ecoRecord.current_streak || 0;
      let highestStreak = ecoRecord.highest_streak || 0;
      let lastClaim = lastClaimStr ? new Date(lastClaimStr) : null;

      if (lastClaim) {
        const diffMs = now.getTime() - lastClaim.getTime();
        const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours

        if (diffMs < cooldownMs) {
          const remainingMs = cooldownMs - diffMs;
          const hours = Math.floor(remainingMs / (60 * 60 * 1000));
          const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

          let timeLeft = '';
          if (hours > 0) timeLeft += `${hours}h `;
          timeLeft += `${minutes}m`;

          const embed = new EmbedBuilder()
            .setColor(0xFF5555)
            .setTitle('🎁 Daily Reward Cooldown')
            .setDescription(`⏳ You've already claimed your daily reward today!\n\nYou can claim it again in **${timeLeft}**.`);

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Missed more than 48 hours? Reset streak
        const resetMs = 48 * 60 * 60 * 1000; // 48 hours
        if (diffMs >= resetMs) {
          currentStreak = 0;
        }
      } else {
        currentStreak = 0;
      }

      // Claim reward
      currentStreak += 1;
      if (currentStreak > highestStreak) {
        highestStreak = currentStreak;
      }

      // Random reward between 100 and 250 coins
      const reward = Math.floor(Math.random() * (250 - 100 + 1)) + 100;
      
      // 7-day streak bonus reward (e.g. 500 coins)
      const hasBonus = currentStreak > 0 && currentStreak % 7 === 0;
      const bonusReward = hasBonus ? 500 : 0;
      const totalReward = reward + bonusReward;

      const currentCoins = ecoRecord.coins || 0;
      const newCoins = currentCoins + totalReward;

      // Persist changes in a transaction
      const claimTx = db.sqlite.transaction(() => {
        db.economy.updateCoins(guildId, userId, newCoins);
        db.economy.updateDaily(guildId, userId, now.toISOString(), currentStreak, highestStreak);
        db.transactions.create(
          guildId,
          userId,
          totalReward,
          currentCoins,
          newCoins,
          'DAILY',
          'DAILY',
          `Daily claim (Streak: ${currentStreak})${hasBonus ? ' + 7-day bonus!' : ''}`
        );
      });
      claimTx();

      // Publish event to EventBus
      const eventBus = require('../../../utils/eventBus');
      eventBus.publish('economyLog', {
        guildId,
        type: 'daily_reward',
        userId,
        amount: totalReward,
        context: { streak: currentStreak }
      });

      // Build professional embed
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎁 Daily Reward Claimed')
        .setDescription(`You successfully claimed your daily reward for today!`)
        .addFields(
          { name: '🎁 Reward', value: `\`+${reward} coins\``, inline: true },
          { name: '🔥 Current Streak', value: `\`${currentStreak} days\``, inline: true },
          { name: '🏆 Highest Streak', value: `\`${highestStreak} days\``, inline: true },
          { name: '💰 New Balance', value: `\`${newCoins.toLocaleString()} coins\``, inline: true }
        )
        .setFooter({ text: 'Economy System • Vishwa Bot' })
        .setTimestamp();

      if (hasBonus) {
        embed.addFields({ name: '🎉 Bonus', value: `\`+${bonusReward} coins\` (7-day streak bonus!)`, inline: false });
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      let errorId;
      if (container.has('errors')) {
        errorId = container.resolve('errors').log(error, 'command:daily');
      } else {
        console.error('[Daily Command] Error executing command:', error);
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
