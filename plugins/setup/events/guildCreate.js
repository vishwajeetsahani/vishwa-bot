/**
 * guildCreate.js
 * -----------------------------------------------------------------------
 * Guild Join Event Listener for Setup Plugin (Vishwa Bot v2.0)
 *
 * Automatically registers default settings records when joining a new
 * Discord guild to minimize dynamic read latencies.
 * -----------------------------------------------------------------------
 */

const container = require('../../../utils/container');

module.exports = {
  name: 'guildCreate',

  async execute(guild, client) {
    const db = container.resolve('db');
    const errors = container.resolve('errors');

    try {
      console.log(`[Startup/GuildCreate] Joined new guild: "${guild.name}" (${guild.id}). Initializing defaults.`);
      db.configs.get(guild.id); // Trigger auto-creation inside configuration table
    } catch (err) {
      errors.log(err, `guildCreate:init:${guild.id}`);
    }
  }
};
