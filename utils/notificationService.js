/**
 * notificationService.js
 * -----------------------------------------------------------------------
 * Notification Dispatcher Module (Vishwa Bot v2.0)
 *
 * Manages outgoing announcements and alerts for level-ups, achievements,
 * quests, shop purchases, rare drops, events, and economy audits.
 * -----------------------------------------------------------------------
 */

class NotificationService {
  constructor() {
    this.announcementsCount = 0;
  }

  /**
   * Publishes alert to a guild channel.
   * @param {import('discord.js').TextChannel} channel 
   * @param {string|object} content 
   */
  async send(channel, content) {
    if (!channel || typeof channel.send !== 'function') {
      console.warn('[NotificationService] Invalid target channel provided.');
      return null;
    }
    
    this.announcementsCount++;
    return channel.send(content);
  }

  /**
   * Dispatches trigger alert checks.
   * @param {string} sourceName (e.g. YouTube feed URL, RSS stream)
   * @param {object} payload data payload
   */
  dispatchFeedUpdate(sourceName, payload) {
    console.log(`[NotificationService] Dispatching notification update from feed "${sourceName}".`);
    const container = require('./container');
    if (container.has('eventBus')) {
      container.resolve('eventBus').publish('feed:update', { source: sourceName, payload });
    }
  }

  /**
   * Helper: Resolves destination channel and sends the notification.
   * @private
   */
  async _dispatch(guild, type, channelKey, getEmbed, defaultTemplate, context) {
    const container = require('./container');
    const db = container.resolve('db');
    const templates = container.resolve('templates');

    // 1. Check if notification type is enabled
    const settings = db.notificationSettings.get(guild.id, type);
    if (!settings.enabled) {
      console.log(`[NotificationService] Skipped notification type "${type}" in "${guild.name}" — disabled in settings.`);
      return null;
    }

    // 2. Resolve destination channel
    const config = db.configs.get(guild.id);
    const channelId = config[channelKey] || config.communityChannel;
    if (!channelId) {
      console.warn(`[NotificationService] Skipped notification type "${type}" in "${guild.name}" — channel not configured.`);
      return null;
    }

    // Attempt to get channel from cache or fetch
    let channel = guild.channels.cache.get(channelId);
    if (!channel) {
      try {
        channel = await guild.channels.fetch(channelId);
      } catch (err) {
        console.error(`[NotificationService] Failed to fetch channel "${channelId}" in "${guild.name}":`, err.message);
        return null;
      }
    }

    if (!channel || typeof channel.send !== 'function') {
      console.warn(`[NotificationService] Skipped notification type "${type}" in "${guild.name}" — invalid text channel.`);
      return null;
    }

    // 3. Parse content/embed templates
    const textVal = templates.parse(defaultTemplate, context);
    const embed = getEmbed(embed => embed.setDescription(textVal));

    // 4. Resolve pings
    let pingContent = '';
    if (settings.mentionType === 'user' && context.user) {
      pingContent = typeof context.user === 'object' ? context.user.toString() : String(context.user);
    } else if (settings.mentionType === 'here') {
      pingContent = '@here';
    } else if (settings.mentionType === 'everyone') {
      pingContent = '@everyone';
    }

    // 5. Send message
    const payload = { embeds: [embed] };
    if (pingContent) {
      payload.content = pingContent;
    }

    try {
      this.announcementsCount++;
      return await channel.send(payload);
    } catch (err) {
      if (container.has('errors')) {
        container.resolve('errors').log(err, `notification_send:${type}:${guild.id}`);
      } else {
        console.error(`[NotificationService] Failed to send notification in "${guild.name}":`, err);
      }
      return null;
    }
  }

  async sendLevelUp(guild, user, level, xp, rank) {
    const container = require('./container');
    const embeds = container.resolve('embeds');

    return this._dispatch(
      guild,
      'level_up',
      'levelChannel',
      build => {
        const embed = embeds.create('success')
          .setTitle('⚡ Level Up!')
          .addFields(
            { name: 'Level', value: `\`${level}\``, inline: true },
            { name: 'XP', value: `\`${xp}\``, inline: true }
          );
        if (rank) {
          embed.addFields({ name: 'Rank', value: `\`#${rank}\``, inline: true });
        }
        if (user && user.displayAvatarURL) {
          embed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
        }
        return build(embed);
      },
      'Congratulations {user}, you have leveled up to level **{level}**! 🎉',
      { user, server: guild.name, level, xp, rank }
    );
  }

  async sendAchievement(guild, user, badge, title) {
    const container = require('./container');
    const embeds = container.resolve('embeds');

    return this._dispatch(
      guild,
      'achievement',
      'achievementChannel',
      build => {
        const embed = embeds.create('success')
          .setTitle('🏆 Achievement Unlocked!')
          .addFields(
            { name: 'Badge', value: `**${badge}**`, inline: true },
            { name: 'Title', value: `*${title}*`, inline: true }
          );
        if (user && user.displayAvatarURL) {
          embed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
        }
        return build(embed);
      },
      'Amazing job {user}! You unlocked the achievement **{badge}** - *{title}*!',
      { user, server: guild.name, badge, title }
    );
  }

  async sendQuestCreated(guild, quest, coins, xp) {
    const container = require('./container');
    const embeds = container.resolve('embeds');

    const reward = `${coins ? `${coins} coins` : ''}${coins && xp ? ' & ' : ''}${xp ? `${xp} XP` : ''}`;

    return this._dispatch(
      guild,
      'quest',
      'questChannel',
      build => {
        const embed = embeds.create('info')
          .setTitle('🗺️ New Quest Available!')
          .addFields(
            { name: 'Quest', value: `**${quest}**`, inline: true },
            { name: 'Rewards', value: `\`${reward}\``, inline: true }
          );
        return build(embed);
      },
      'A new quest is available on {server}: **{quest}**! Reward: {reward}',
      { server: guild.name, quest, coins, xp, reward }
    );
  }

  async sendQuestCompleted(guild, user, quest, reward) {
    const container = require('./container');
    const embeds = container.resolve('embeds');

    return this._dispatch(
      guild,
      'quest',
      'questChannel',
      build => {
        const embed = embeds.create('success')
          .setTitle('✅ Quest Completed!')
          .addFields(
            { name: 'Quest', value: `**${quest}**`, inline: true },
            { name: 'Reward Claimed', value: `\`${reward}\``, inline: true }
          );
        if (user && user.displayAvatarURL) {
          embed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
        }
        return build(embed);
      },
      '{user} has completed the quest **{quest}** and claimed **{reward}**!',
      { user, server: guild.name, quest, reward }
    );
  }

  async sendRareDrop(guild, user, item, rarity) {
    const container = require('./container');
    const embeds = container.resolve('embeds');

    return this._dispatch(
      guild,
      'rare_drop',
      'rareDropChannel',
      build => {
        const embed = embeds.create('warn')
          .setTitle('✨ Rare Drop!')
          .addFields(
            { name: 'Item', value: `🎁 **${item}**`, inline: true },
            { name: 'Rarity', value: `\`${rarity}\``, inline: true }
          );
        if (user && user.displayAvatarURL) {
          embed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
        }
        return build(embed);
      },
      'Oh my! {user} got a rare drop on {server}: **{item}** ({rank})!',
      { user, server: guild.name, item, badge: rarity, rank: rarity }
    );
  }

  async sendEconomyLog(guild, logText) {
    const container = require('./container');
    const embeds = container.resolve('embeds');

    const coinsMatch = logText.match(/(-?\d+)\s*coins/i);
    const coins = coinsMatch ? coinsMatch[1] : '';

    return this._dispatch(
      guild,
      'economy',
      'economyLogChannel',
      build => {
        const embed = embeds.create('warn')
          .setTitle('💰 Economy Audit Log');
        return build(embed);
      },
      'Audit alert: {reward}',
      { server: guild.name, reward: logText, coins }
    );
  }

  async sendShopPurchase(guild, user, item, coins) {
    const container = require('./container');
    const embeds = container.resolve('embeds');

    return this._dispatch(
      guild,
      'shop',
      'shopChannel',
      build => {
        const embed = embeds.create('info')
          .setTitle('🛒 Shop Purchase')
          .addFields(
            { name: 'Item Purchased', value: `**${item}**`, inline: true },
            { name: 'Price Paid', value: `\`${coins} coins\``, inline: true }
          );
        if (user && user.displayAvatarURL) {
          embed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
        }
        return build(embed);
      },
      '{user} purchased **{item}** from the shop for **{coins} coins**!',
      { user, server: guild.name, item, coins }
    );
  }

  async sendEventAnnouncement(guild, title, reward) {
    const container = require('./container');
    const embeds = container.resolve('embeds');

    return this._dispatch(
      guild,
      'event',
      'eventChannel',
      build => {
        const embed = embeds.create('info')
          .setTitle('📅 Event Announcement')
          .addFields(
            { name: 'Event', value: `**${title}**`, inline: true }
          );
        if (reward) {
          embed.addFields({ name: 'Rewards / Details', value: `\`${reward}\``, inline: true });
        }
        return build(embed);
      },
      '📢 Attention! A new server event is happening: **{title}**! Reward: {reward}',
      { server: guild.name, title, reward }
    );
  }
}

module.exports = new NotificationService();
