/**
 * ready.js
 * -----------------------------------------------------------------------
 * Fires once when the bot successfully logs in and is ready to operate.
 * Sets the bot's presence/activity and logs startup info to console.
 * -----------------------------------------------------------------------
 */

const { ActivityType } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  /**
   * @param {import('discord.js').Client} client
   */
  execute(client) {
    console.log('========================================');
    console.log(`  Vishwa Bot is online!`);
    console.log(`  Logged in as: ${client.user.tag}`);
    console.log(`  Serving ${client.guilds.cache.size} guild(s)`);
    console.log('========================================');

    // Set a simple rotating-style presence (static here, but easy to extend)
    client.user.setPresence({
      activities: [
        {
          name: `${client.guilds.cache.size} servers | /help`,
          type: ActivityType.Watching
        }
      ],
      status: 'online'
    });

    // Register slash commands dynamically on startup
    const slashCommands = Array.from(client.commands.values())
      .filter(cmd => cmd.data)
      .map(cmd => cmd.data.toJSON());

    if (slashCommands.length > 0) {
      console.log(`[Slash Commands] Registering ${slashCommands.length} commands...`);
      client.application.commands.set(slashCommands)
        .then(() => console.log(`[Slash Commands] Successfully registered ${slashCommands.length} global commands.`))
        .catch((err) => console.error('[Slash Commands] Failed to register global commands:', err));
    }
  }
};
