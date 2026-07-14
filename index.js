/**
 * index.js
 * -----------------------------------------------------------------------
 * Vishwa Bot — Main Entry Point
 *
 * A professional, production-ready Discord.js v14 moderation bot.
 * This file:
 *   1. Loads environment variables.
 *   2. Initializes the Discord client with required intents.
 *   3. Ensures local JSON data files exist.
 *   4. Loads all commands and events via their respective handlers.
 *   5. Sets up global error handlers so the process never silently dies.
 *   6. Logs in to Discord.
 *
 * Compatible with free hosting platforms (e.g. WispByte) — no database,
 * no external services required beyond the Discord API itself.
 * -----------------------------------------------------------------------
 */

require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const database = require('./utils/database');
const { loadEvents } = require('./utils/eventHandler');
const { migrate } = require('./utils/migrate');
const { loadPlugins } = require('./utils/pluginManager');

const container = require('./utils/container');
const eventBus = require('./utils/eventBus');
const scheduler = require('./utils/scheduler');
const cache = require('./utils/cache');
const metrics = require('./utils/metrics');
const errorManager = require('./utils/errorManager');
const embedBuilder = require('./utils/embedBuilder');
const componentBuilder = require('./utils/componentBuilder');
const imageService = require('./utils/imageService');
const notificationService = require('./utils/notificationService');
const templateEngine = require('./utils/templateEngine');
const { ModerationService } = require('./utils/moderationService');
const { EconomyService } = require('./plugins/economy/services/EconomyService');

// Register all core services in Service Container on bootstrap
container.register('db', database);
container.register('eventBus', eventBus);
container.register('scheduler', scheduler);
container.register('cache', cache);
container.register('metrics', metrics);
container.register('errors', errorManager);
container.register('embeds', embedBuilder);
container.register('components', componentBuilder);
container.register('image', imageService);
container.register('notifications', notificationService);
container.register('templates', templateEngine);
container.register('moderation', ModerationService);
container.register('economy', EconomyService);

// ---------------------------------------------------------------------
// Validate required environment variables before doing anything else
// ---------------------------------------------------------------------
if (!process.env.DISCORD_TOKEN) {
  console.error('[Startup] Missing DISCORD_TOKEN in environment variables. Please check your .env file.');
  process.exit(1);
}

// ---------------------------------------------------------------------
// Initialize the Discord Client
// ---------------------------------------------------------------------
// Intents required:
//  - Guilds: basic guild data, channels, roles
//  - GuildMembers: required for welcome/goodbye/auto-role (PRIVILEGED — must be enabled in Dev Portal)
//  - GuildMessages: required to receive message content events
//  - MessageContent: required to read message text for commands/automod (PRIVILEGED)
//  - GuildModeration: ban/kick related events
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

container.register('client', client);

(async () => {
  try {
    // Initialize WebAssembly sql.js database first
    await database.init();

    // Ensure data files exist (fresh deployments won't crash)
    database.ensureDataFiles();
    migrate();

    // Load commands and events
    loadEvents(client);
    loadPlugins(client);

    // Centralized entity resolvers
    const resolveGuild = async (guildId) => {
      return client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    };

    const resolveUser = async (userId) => {
      if (!userId) return null;
      return client.users.cache.get(userId) || await client.users.fetch(userId).catch(() => null);
    };

    // Register global Level Up notification subscriber
    eventBus.subscribe('userLevelUp', async ({ guildId, userId, oldLevel, newLevel, xp }) => {
      console.log(`[TRACE] Event Received: userLevelUp. guildId: ${guildId}, userId: ${userId}, oldLevel: ${oldLevel}, newLevel: ${newLevel}`);
      try {
        const guild = await resolveGuild(guildId);
        if (!guild) {
          console.log(`[TRACE] Guild ${guildId} not found/resolved. Returning.`);
          return;
        }
        console.log(`[TRACE] Config Loaded for guild: ${guild.name}`);
        const user = await resolveUser(userId);
        if (!user) {
          console.log(`[TRACE] User ${userId} not found/resolved. Returning.`);
          return;
        }
        console.log(`[TRACE] Notification Received: Calling notificationService.sendAnnouncement`);
        const result = await notificationService.sendAnnouncement(guild, 'level_up', user, { level: newLevel, xp });
        if (result) {
          console.log(`[TRACE] Message Sent: Announcement message ID ${result.id}`);
        } else {
          console.log(`[TRACE] Message Skipped/Failed in NotificationService`);
        }
      } catch (err) {
        console.log('[TRACE] Error in userLevelUp subscriber:', err);
        errorManager.log(err, 'eventBus_userLevelUp_handler');
      }
    });

    eventBus.subscribe('economyLog', async ({ guildId, type, userId, amount, context }) => {
      console.log(`[TRACE] Event Received: economyLog. Type: ${type}, Guild: ${guildId}, User: ${userId}`);
      try {
        const guild = await resolveGuild(guildId);
        if (!guild) {
          console.log(`[TRACE] Guild ${guildId} not found/resolved. Returning.`);
          return;
        }
        console.log(`[TRACE] Config Loaded for guild: ${guild.name}`);
        const user = await resolveUser(userId);
        if (!user) {
          console.log(`[TRACE] User ${userId} not found/resolved. Returning.`);
          return;
        }
        console.log(`[TRACE] Notification Received: Calling notificationService.sendEconomyLog`);
        const result = await notificationService.sendEconomyLog(guild, type, user, amount, context);
        if (result) {
          console.log(`[TRACE] Message Sent: Economy log message ID ${result.id}`);
        } else {
          console.log(`[TRACE] Message Skipped/Failed in NotificationService`);
        }
      } catch (err) {
        console.log('[TRACE] Error in economyLog subscriber:', err);
        errorManager.log(err, 'eventBus_economyLog_handler');
      }
    });

    eventBus.subscribe('adminLog', async ({ guildId, type, adminId, targetId, context }) => {
      console.log(`[TRACE] Event Received: adminLog. Type: ${type}, Guild: ${guildId}, Admin: ${adminId}`);
      try {
        const guild = await resolveGuild(guildId);
        if (!guild) {
          console.log(`[TRACE] Guild ${guildId} not found/resolved. Returning.`);
          return;
        }
        console.log(`[TRACE] Config Loaded for guild: ${guild.name}`);
        const admin = await resolveUser(adminId);
        if (!admin) {
          console.log(`[TRACE] Admin ${adminId} not found/resolved. Returning.`);
          return;
        }
        const target = targetId ? await resolveUser(targetId) : null;
        console.log(`[TRACE] Notification Received: Calling notificationService.sendAdminLog`);
        const result = await notificationService.sendAdminLog(guild, type, admin, target, context);
        if (result) {
          console.log(`[TRACE] Message Sent: Admin log message ID ${result.id}`);
        } else {
          console.log(`[TRACE] Message Skipped/Failed in NotificationService`);
        }
      } catch (err) {
        console.log('[TRACE] Error in adminLog subscriber:', err);
        errorManager.log(err, 'eventBus_adminLog_handler');
      }
    });

    eventBus.subscribe('questComplete', async ({ guildId, userId, questName, reward }) => {
      console.log(`[TRACE] Event Received: questComplete. Guild: ${guildId}, User: ${userId}`);
      try {
        const guild = await resolveGuild(guildId);
        if (!guild) return;
        const user = await resolveUser(userId);
        if (!user) return;
        console.log(`[TRACE] Notification Received: Calling notificationService.sendQuestNotification`);
        const result = await notificationService.sendQuestNotification(guild, 'quest_complete', user, { reward: `${questName} (Reward: ${reward})` });
        if (result) console.log(`[TRACE] Message Sent: Quest Complete ID ${result.id}`);
      } catch (err) {
        console.log('[TRACE] Error in questComplete subscriber:', err);
      }
    });

    eventBus.subscribe('achievementUnlock', async ({ guildId, userId, achievementId, reward }) => {
      console.log(`[TRACE] Event Received: achievementUnlock. Guild: ${guildId}, User: ${userId}`);
      try {
        const guild = await resolveGuild(guildId);
        if (!guild) return;
        const user = await resolveUser(userId);
        if (!user) return;
        console.log(`[TRACE] Notification Received: Calling notificationService.sendAchievement`);
        const result = await notificationService.sendAchievement(guild, achievementId, user, { reward });
        if (result) console.log(`[TRACE] Message Sent: Achievement Unlock ID ${result.id}`);
      } catch (err) {
        console.log('[TRACE] Error in achievementUnlock subscriber:', err);
      }
    });

    eventBus.subscribe('rareDrop', async ({ guildId, userId, itemName, reward }) => {
      console.log(`[TRACE] Event Received: rareDrop. Guild: ${guildId}, User: ${userId}`);
      try {
        const guild = await resolveGuild(guildId);
        if (!guild) return;
        const user = await resolveUser(userId);
        if (!user) return;
        console.log(`[TRACE] Notification Received: Calling notificationService.sendRareDrop`);
        const result = await notificationService.sendRareDrop(guild, itemName, user, { reward });
        if (result) console.log(`[TRACE] Message Sent: Rare Drop ID ${result.id}`);
      } catch (err) {
        console.log('[TRACE] Error in rareDrop subscriber:', err);
      }
    });

    eventBus.subscribe('shopPurchase', async ({ guildId, userId, itemName, cost, reward }) => {
      console.log(`[TRACE] Event Received: shopPurchase. Guild: ${guildId}, User: ${userId}`);
      try {
        const guild = await resolveGuild(guildId);
        if (!guild) return;
        const user = await resolveUser(userId);
        if (!user) return;
        console.log(`[TRACE] Notification Received: Calling notificationService.sendShopNotification`);
        const result = await notificationService.sendShopNotification(guild, itemName, user, { reward });
        if (result) console.log(`[TRACE] Message Sent: Shop Purchase ID ${result.id}`);
      } catch (err) {
        console.log('[TRACE] Error in shopPurchase subscriber:', err);
      }
    });

    eventBus.subscribe('tradeComplete', async ({ guildId, senderId, receiverId, amount, reason }) => {
      console.log(`[TRACE] Event Received: tradeComplete. Guild: ${guildId}, Sender: ${senderId}`);
      try {
        const guild = await resolveGuild(guildId);
        if (!guild) return;
        const sender = await resolveUser(senderId);
        if (!sender) return;
        const receiver = await resolveUser(receiverId);
        const receiverTag = receiver ? receiver.toString() : `<@${receiverId}>`;
        console.log(`[TRACE] Notification Received: Calling notificationService.sendEconomyLog`);
        const result = await notificationService.sendEconomyLog(guild, 'trade', sender, amount, { target: receiverTag, reason });
        if (result) console.log(`[TRACE] Message Sent: Trade Complete ID ${result.id}`);
      } catch (err) {
        console.log('[TRACE] Error in tradeComplete subscriber:', err);
      }
    });

    eventBus.subscribe('leaderboardUpdate', async ({ guildId, type, reward }) => {
      console.log(`[TRACE] Event Received: leaderboardUpdate. Guild: ${guildId}`);
      try {
        const guild = await resolveGuild(guildId);
        if (!guild) return;
        console.log(`[TRACE] Notification Received: Calling notificationService.sendLeaderboard`);
        const result = await notificationService.sendLeaderboard(guild, type, { reward });
        if (result) console.log(`[TRACE] Message Sent: Leaderboard Update ID ${result.id}`);
      } catch (err) {
        console.log('[TRACE] Error in leaderboardUpdate subscriber:', err);
      }
    });

    eventBus.subscribe('eventUpdate', async ({ guildId, type, reward }) => {
      console.log(`[TRACE] Event Received: eventUpdate. Guild: ${guildId}`);
      try {
        const guild = await resolveGuild(guildId);
        if (!guild) return;
        console.log(`[TRACE] Notification Received: Calling notificationService.sendEvent`);
        const result = await notificationService.sendEvent(guild, type, { reward });
        if (result) console.log(`[TRACE] Message Sent: Event Update ID ${result.id}`);
      } catch (err) {
        console.log('[TRACE] Error in eventUpdate subscriber:', err);
      }
    });

    eventBus.subscribe('inventoryUpdate', async ({ guildId, userId, itemId, quantity, action }) => {
      console.log(`[TRACE] Event Received: inventoryUpdate. Guild: ${guildId}, User: ${userId}`);
      try {
        const guild = await resolveGuild(guildId);
        if (!guild) return;
        const user = await resolveUser(userId);
        if (!user) return;
        console.log(`[TRACE] Notification Received: Calling notificationService.sendEconomyLog`);
        const result = await notificationService.sendEconomyLog(guild, 'inventory_item', user, quantity, { item: itemId, quantity, action });
        if (result) console.log(`[TRACE] Message Sent: Inventory Update ID ${result.id}`);
      } catch (err) {
        console.log('[TRACE] Error in inventoryUpdate subscriber:', err);
      }
    });

    // Global safety nets
    process.on('unhandledRejection', (reason) => {
      errorManager.log(reason instanceof Error ? reason : new Error(String(reason)), 'process_unhandledRejection');
    });

    process.on('uncaughtException', (err) => {
      errorManager.log(err, 'process_uncaughtException');
    });

    // Login
    client.login(process.env.DISCORD_TOKEN).catch((err) => {
      console.error('[Startup] Failed to log in to Discord. Check your DISCORD_TOKEN.', err.message);
      process.exit(1);
    });
  } catch (initErr) {
    console.error('[Startup] Critical error during bootstrap:', initErr);
    process.exit(1);
  }
})();
