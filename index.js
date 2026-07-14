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

    // Register global Level Up notification subscriber
    eventBus.subscribe('userLevelUp', async ({ guildId, userId, oldLevel, newLevel, xp }) => {
      console.log(`[TRACE] EventBus userLevelUp event received. guildId: ${guildId}, userId: ${userId}, oldLevel: ${oldLevel}, newLevel: ${newLevel}`);
      try {
        const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch((fetchErr) => {
          console.log(`[TRACE] Failed to fetch guild ${guildId}:`, fetchErr.message);
          return null;
        });
        if (!guild) {
          console.log(`[TRACE] Guild ${guildId} not found/resolved. Returning.`);
          return;
        }
        console.log(`[TRACE] Resolved guild: ${guild.name}`);

        const user = client.users.cache.get(userId) || await client.users.fetch(userId).catch((fetchErr) => {
          console.log(`[TRACE] Failed to fetch user ${userId}:`, fetchErr.message);
          return null;
        });
        if (!user) {
          console.log(`[TRACE] User ${userId} not found/resolved. Returning.`);
          return;
        }
        console.log(`[TRACE] Resolved user: ${user.tag || user.username}`);

        console.log(`[TRACE] Calling notificationService.sendAnnouncement`);
        const result = await notificationService.sendAnnouncement(guild, 'level_up', user, { level: newLevel, xp });
        console.log(`[TRACE] sendAnnouncement result:`, result ? 'Success (Message ID: ' + result.id + ')' : 'Failure/Skipped');
      } catch (err) {
        console.log('[TRACE] Error in userLevelUp subscriber:', err);
        errorManager.log(err, 'eventBus_userLevelUp_handler');
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
