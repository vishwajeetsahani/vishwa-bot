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

  getIcon(type) {
    const icons = {
      level_up: '⚡',
      daily_reward: '🎁',
      coins_added: '➕',
      coins_removed: '➖',
      coins_set: '⚙️',
      coins_reset: '🔄',
      xp_added: '✨',
      xp_removed: '📉',
      xp_set: '🔧',
      xp_reset: '🔃',
      deposit: '🏦',
      withdraw: '💸',
      reward_transaction: '🪙',
      trade: '🤝',
      inventory_item: '📦',
      economy_config_changed: '🛠️',
      admin_economy_command: '🛡️',
      admin_xp_command: '🛡️',
      quest: '🗺️',
      shop: '🛒',
      rare_drop: '💎',
      achievement: '🏆',
      leaderboard: '📊',
      event: '📅'
    };
    return icons[type] || '📢';
  }

  _buildGamingEmbed(guild, title, description, type, importanceLevel) {
    const container = require('./container');
    const embeds = container.resolve('embeds');

    // Mapped neon colors
    const colors = {
      low: 0x5865F2,     // Neon Blurple
      high: 0xBD00FF,    // Neon Purple/Magenta
      admin: 0xFF003C    // Neon Red
    };

    const color = colors[importanceLevel.toLowerCase()] || colors.high;
    const icon = this.getIcon(type);

    return embeds.create('info')
      .setColor(color)
      .setTitle(`${icon} ${title}`)
      .setDescription(description)
      .setFooter({ text: '🎮 Vishwa Bot Community Core' })
      .setTimestamp();
  }

  /**
   * Helper: Resolves destination channel and sends the notification.
   * @private
   */
  async _dispatchGeneric({ guild, type, channelKey, importance, title, template, user, target, context }) {
    const container = require('./container');
    const db = container.resolve('db');
    const templates = container.resolve('templates');

    console.log(`[TRACE] _dispatchGeneric for type: ${type}, channelKey: ${channelKey}`);

    // 1. Check if notification type is enabled (map specific type to category settings based on channelKey)
    const categoryMapping = {
      announcementChannel: 'level_up',
      economyLogChannel: 'economy_log',
      adminLogChannel: 'admin_log',
      questChannel: 'quest',
      shopChannel: 'shop',
      rareDropChannel: 'rare_drop',
      achievementChannel: 'achievement',
      leaderboardChannel: 'leaderboard',
      eventChannel: 'event'
    };
    const parentKey = categoryMapping[channelKey] || type;
    const settings = db.notificationSettings.get(guild.id, parentKey);
    console.log(`[TRACE] Settings for ${type} (mapped to category ${parentKey}): enabled = ${settings.enabled}`);
    if (!settings.enabled) {
      console.log(`[NotificationService] Skipped notification type "${type}" in "${guild.name}" — disabled in settings.`);
      return null;
    }

    // 2. Resolve destination channel
    const config = db.configs.get(guild.id);
    const channelId = config[channelKey];
    console.log(`[TRACE] Configured channel ID for ${channelKey}:`, channelId);
    if (!channelId) {
      console.log(`[NotificationService] Skipped notification type "${type}" in "${guild.name}" — channel not configured.`);
      return null;
    }

    // 3. Try to get channel and check permissions
    let channel;
    try {
      channel = guild.channels.cache.get(channelId);
      if (!channel) {
        console.log(`[TRACE] Channel not in cache. Fetching channel ${channelId}`);
        channel = await guild.channels.fetch(channelId);
      }
    } catch (err) {
      console.log(`[TRACE] Error fetching channel ${channelId}:`, err.message);
      if (container.has('errors')) {
        container.resolve('errors').log(err, `notification_channel_fetch_error:${type}:${guild.id}`);
      } else {
        console.error(`[NotificationService] Failed to fetch channel "${channelId}":`, err.message);
      }
      return null;
    }

    if (!channel || typeof channel.send !== 'function') {
      console.log(`[NotificationService] Skipped notification type "${type}" in "${guild.name}" — invalid or deleted channel.`);
      return null;
    }
    console.log(`[TRACE] Resolved channel: ${channel.name}`);

    // Check bot permissions in this channel
    const botMember = guild.members.me;
    if (botMember) {
      const perms = channel.permissionsFor(botMember);
      console.log(`[TRACE] Bot permissions in channel: SendMessages = ${perms ? perms.has('SendMessages') : false}, EmbedLinks = ${perms ? perms.has('EmbedLinks') : false}`);
      if (perms && (!perms.has('SendMessages') || !perms.has('EmbedLinks'))) {
        console.log(`[TRACE] Missing SendMessages or EmbedLinks permissions in channel ${channel.name}`);
        const missingPermsErr = new Error(`Missing SendMessages or EmbedLinks permissions in channel ${channel.name}`);
        if (container.has('errors')) {
          container.resolve('errors').log(missingPermsErr, `notification_missing_permissions:${type}:${guild.id}`);
        } else {
          console.error(`[NotificationService] Missing permissions in channel "${channel.name}": SendMessages / EmbedLinks`);
        }
        return null;
      }
    }

    // 4. Parse content using TemplateEngine
    const parseCtx = {
      server: guild.name,
      ...context
    };
    if (user) parseCtx.user = user;
    if (target) parseCtx.target = target;

    const description = templates.parse(template, parseCtx);

    // 5. Build premium Gaming Theme embed
    const embed = this._buildGamingEmbed(guild, title, description, type, importance);

    // 6. Resolve mention pings
    let pingContent = '';
    if (settings.mentionType === 'user' && user) {
      pingContent = typeof user === 'object' ? user.toString() : String(user);
    } else if (settings.mentionType === 'here') {
      pingContent = '@here';
    } else if (settings.mentionType === 'everyone') {
      pingContent = '@everyone';
    } else if (settings.mentionType === 'role' && settings.mentionRoleId) {
      pingContent = `<@&${settings.mentionRoleId}>`;
    }

    // 7. Dispatch message
    const payload = { embeds: [embed] };
    if (pingContent) {
      payload.content = pingContent;
    }

    try {
      this.announcementsCount++;
      console.log(`[TRACE] Attempting to send message payload to channel...`);
      const sentMsg = await channel.send(payload);
      console.log(`[TRACE] Message successfully sent! Message ID: ${sentMsg.id}`);
      return sentMsg;
    } catch (err) {
      console.log(`[TRACE] Exception caught during channel.send:`, err.message);
      if (container.has('errors')) {
        container.resolve('errors').log(err, `notification_send_error:${type}:${guild.id}`);
      } else {
        console.error(`[NotificationService] Failed to send message in channel "${channel.name}":`, err);
      }
      return null;
    }
  }

  async sendAnnouncement(guild, type, user, context = {}) {
    const defaultTemplates = {
      level_up: 'Congratulations {user}, you have leveled up to level **{level}**! 🎉'
    };
    const template = defaultTemplates[type] || 'Announcement: {reward}';

    return this._dispatchGeneric({
      guild,
      type,
      channelKey: 'announcementChannel',
      importance: 'high',
      title: 'Announcement Alert',
      template,
      user,
      context: { ...context, user }
    });
  }

  async sendEconomyLog(guild, type, user, amount, context = {}) {
    const defaultTemplates = {
      daily_reward: '{user} claimed their daily reward and earned **{coins} coins**! 🔥',
      coins_added: 'Successfully added **{coins} coins** to {user}.',
      coins_removed: 'Successfully removed **{coins} coins** from {user}.',
      coins_set: 'Set {user}\'s coins balance to **{coins}**.',
      coins_reset: 'Reset {user}\'s coins balance.',
      xp_added: 'Successfully added **{xp} XP** to {user}.',
      xp_removed: 'Successfully removed **{xp} XP** from {user}.',
      xp_set: 'Set {user}\'s XP balance to **{xp}**.',
      xp_reset: 'Reset {user}\'s XP balance.',
      deposit: '{user} deposited **{coins} coins** into the bank.',
      withdraw: '{user} withdrew **{coins} coins** from the bank.',
      reward_transaction: 'Rewarded {user} **{coins} coins** (Source: {reward}).',
      trade: '{user} transferred **{coins} coins** to {target}. Reason: {reward}',
      inventory_item: '{user} {action}ed **{quantity}x {item}** in their inventory.'
    };

    const template = defaultTemplates[type] || 'Economy action: {reward}';
    const formattedType = type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    return this._dispatchGeneric({
      guild,
      type,
      channelKey: 'economyLogChannel',
      importance: 'low',
      title: `Economy Log: ${formattedType}`,
      template,
      user,
      context: {
        ...context,
        coins: amount,
        xp: amount,
        reward: context.reason || context.source || ''
      }
    });
  }

  async sendAdminLog(guild, type, admin, target, context = {}) {
    const defaultTemplates = {
      economy_config_changed: '🛡️ Admin {user} changed the economy configurations: {reward}',
      admin_economy_command: '🛡️ Admin {user} executed economy command on target {target}. Details: {reward}',
      admin_xp_command: '🛡️ Admin {user} executed XP command on target {target}. Details: {reward}'
    };

    const template = defaultTemplates[type] || 'Admin action by {user}';
    const formattedType = type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    return this._dispatchGeneric({
      guild,
      type,
      channelKey: 'adminLogChannel',
      importance: 'admin',
      title: `Admin Audit: ${formattedType}`,
      template,
      user: admin,
      target,
      context: {
        ...context,
        reward: context.reason || context.details || ''
      }
    });
  }

  async sendQuestNotification(guild, type, user, context = {}) {
    return this._dispatchGeneric({
      guild,
      type,
      channelKey: 'questChannel',
      importance: 'high',
      title: `Quest Update: ${type}`,
      template: 'Quest Alert for {user}: {reward}',
      user,
      context
    });
  }

  async sendShopNotification(guild, type, user, context = {}) {
    return this._dispatchGeneric({
      guild,
      type,
      channelKey: 'shopChannel',
      importance: 'low',
      title: `Shop Update: ${type}`,
      template: 'Shop purchase/refresh alert: {reward}',
      user,
      context
    });
  }

  async sendRareDrop(guild, type, user, context = {}) {
    return this._dispatchGeneric({
      guild,
      type,
      channelKey: 'rareDropChannel',
      importance: 'high',
      title: `Rare Drop: ${type}`,
      template: 'Rare item drop alert: {reward}',
      user,
      context
    });
  }

  async sendAchievement(guild, type, user, context = {}) {
    return this._dispatchGeneric({
      guild,
      type,
      channelKey: 'achievementChannel',
      importance: 'high',
      title: `Achievement: ${type}`,
      template: 'Achievement unlock alert: {reward}',
      user,
      context
    });
  }

  async sendLeaderboard(guild, type, context = {}) {
    return this._dispatchGeneric({
      guild,
      type,
      channelKey: 'leaderboardChannel',
      importance: 'high',
      title: `Leaderboard Update: ${type}`,
      template: 'Leaderboard alert: {reward}',
      context
    });
  }

  async sendEvent(guild, type, context = {}) {
    return this._dispatchGeneric({
      guild,
      type,
      channelKey: 'eventChannel',
      importance: 'high',
      title: `Event Update: ${type}`,
      template: 'Event alert: {reward}',
      context
    });
  }
}

module.exports = new NotificationService();
