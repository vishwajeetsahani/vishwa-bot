/**
 * eventHandler.js
 * -----------------------------------------------------------------------
 * Loads every event file from /events and binds it to the Discord client.
 *
 * Each event file must export:
 * {
 *   name: string,        // Discord.js event name (e.g. "messageCreate")
 *   once?: boolean,       // if true, uses client.once instead of client.on
 *   execute: async (...args, client) => {}
 * }
 * -----------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');

/**
 * Loads all event files and registers them on the client.
 * @param {import('discord.js').Client} client
 */
function loadEvents(client) {
  const eventsDir = path.join(__dirname, '..', 'events');
  if (!fs.existsSync(eventsDir)) {
    console.warn('[EventHandler] /events directory not found, skipping load.');
    return;
  }

  const files = fs.readdirSync(eventsDir).filter((f) => f.endsWith('.js'));
  let loadedCount = 0;

  for (const file of files) {
    try {
      const filePath = path.join(eventsDir, file);
      delete require.cache[require.resolve(filePath)];
      const event = require(filePath);

      if (!event.name || typeof event.execute !== 'function') {
        console.warn(`[EventHandler] Skipping invalid event file: ${file}`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }

      loadedCount++;
    } catch (err) {
      console.error(`[EventHandler] Failed to load event file ${file}:`, err);
    }
  }

  console.log(`[EventHandler] Loaded ${loadedCount} event(s).`);
}

module.exports = { loadEvents };
