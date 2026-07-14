const cache = require('../../../utils/cache');
const container = require('../../../utils/container');
const eventBus = require('../../../utils/eventBus');

module.exports = {
  name: 'messageCreate',

  async execute(message, client) {
    try {
      // Ignore bots, system messages, webhooks, slash command outputs, and non-guild messages
      if (message.author.bot || message.system || message.webhookId || !message.guild || message.interaction) {
        return;
      }

      const guildId = message.guild.id;
      const userId = message.author.id;

      // 60-second XP cooldown per user
      const cooldownKey = `xp-cooldown:${guildId}:${userId}`;
      if (cache.get(cooldownKey)) {
        return; // No XP during cooldown
      }

      if (!container.has('economy')) {
        return;
      }
      const economyService = container.resolve('economy');

      // Random XP reward: 15 to 25 XP
      const xpReward = Math.floor(Math.random() * (25 - 15 + 1)) + 15;

      // Award XP
      const xpResult = economyService.addXP(userId, guildId, xpReward, 'CHAT');

      // Set cooldown for 60 seconds
      cache.set(cooldownKey, true, 60 * 1000);

      // On level up: publish event via EventBus
      if (xpResult && xpResult.leveledUp) {
        eventBus.publish('userLevelUp', {
          guildId,
          userId,
          oldLevel: xpResult.oldLevel,
          newLevel: xpResult.newLevel,
          xp: xpResult.newXp
        });
      }
    } catch (err) {
      if (container.has('errors')) {
        container.resolve('errors').log(err, 'event:messageCreate:economy');
      } else {
        console.error('[Economy messageCreate] Error awarding XP:', err);
      }
    }
  }
};
