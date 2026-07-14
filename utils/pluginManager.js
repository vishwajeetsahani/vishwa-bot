/**
 * pluginManager.js
 * -----------------------------------------------------------------------
 * Plugin Manager (Vishwa Bot v2.0)
 *
 * Automatically registers modular plugins under the /plugins directory.
 * Standardizes dynamic loading for slash commands and event handlers.
 * Wraps events in a dynamic checker that checks if the plugin is enabled
 * for the guild.
 * -----------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');

/**
 * Dynamically resolves the guild ID from event arguments.
 * Supports Message, Interaction, GuildMember, VoiceState, Guild etc.
 */
function getGuildIdFromArgs(args) {
  if (!args || args.length === 0) return null;
  const arg = args[0];
  if (!arg) return null;

  if (arg.guild) return arg.guild.id;
  if (arg.guildId) return arg.guildId;
  if (arg.message && arg.message.guild) return arg.message.guild.id;
  if (arg.id && arg.constructor.name === 'Guild') return arg.id;
  
  return null;
}

/**
 * Recursively walks a directory to find files ending with .js.
 */
function getJsFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Loads all plugins, their commands, and wraps event handlers.
 * @param {import('discord.js').Client} client 
 */
function loadPlugins(client) {
  const container = require('./container');
  client.commands = client.commands || new Collection();
  client.pluginsList = []; // Array of registered plugin configurations

  if (!fs.existsSync(PLUGINS_DIR)) {
    console.warn('[PluginManager] /plugins directory not found.');
    return;
  }

  const pluginDirs = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  let loadedCount = 0;

  for (const dir of pluginDirs) {
    const startTime = Date.now();
    const pluginPath = path.join(PLUGINS_DIR, dir);
    const configPath = path.join(pluginPath, 'plugin.json');

    if (!fs.existsSync(configPath)) {
      console.warn(`[PluginManager] Skipping directory "${dir}" — missing plugin.json.`);
      continue;
    }

    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
      if (container.has('errors')) {
        container.resolve('errors').log(err, `plugin_parse_json:${dir}`);
      } else {
        console.error(`[PluginManager] Failed to parse plugin.json for "${dir}":`, err.message);
      }
      continue;
    }

    if (!config.name) {
      console.warn(`[PluginManager] Skipping plugin in "${dir}" — missing name in descriptor.`);
      continue;
    }

    const enabledByDefault = config.enabledByDefault !== false;
    config.enabledByDefault = enabledByDefault;

    client.pluginsList.push(config);

    // -------------------------------------------------------------
    // Load Commands
    // -------------------------------------------------------------
    const commandsPath = path.join(pluginPath, 'commands');
    if (fs.existsSync(commandsPath)) {
      const commandFiles = getJsFiles(commandsPath);
      for (const file of commandFiles) {
        try {
          const command = require(file);
          if (!command.data || !command.data.name || typeof command.execute !== 'function') {
            console.warn(`[PluginManager] Invalid command skipped at: ${file}`);
            continue;
          }
          
          command.plugin = config.name; // Tag command with owning plugin
          client.commands.set(command.data.name, command);
        } catch (err) {
          if (container.has('errors')) {
            container.resolve('errors').log(err, `plugin_load_command:${file}`);
          } else {
            console.error(`[PluginManager] Failed to load command at ${file}:`, err);
          }
        }
      }
    }

    // -------------------------------------------------------------
    // Load Events
    // -------------------------------------------------------------
    const eventsPath = path.join(pluginPath, 'events');
    if (fs.existsSync(eventsPath)) {
      const eventFiles = getJsFiles(eventsPath);
      for (const file of eventFiles) {
        try {
          const event = require(file);
          if (!event.name || typeof event.execute !== 'function') {
            console.warn(`[PluginManager] Invalid event skipped at: ${file}`);
            continue;
          }

          // Register wrapped event handler that validates plugin enable state per-guild
          const wrapperHandler = async (...args) => {
            const guildId = getGuildIdFromArgs(args);
            if (guildId) {
              const { plugins } = require('./database');
              const isEnabled = plugins.isEnabled(guildId, config.name, config.enabledByDefault);
              if (!isEnabled) return; // Skip if disabled for this guild
            }

            try {
              await event.execute(...args, client);
            } catch (err) {
              if (container.has('errors')) {
                container.resolve('errors').log(err, `plugin_event:${config.name}:${event.name}`);
              } else {
                console.error(`[PluginManager] Error in event "${event.name}" of plugin "${config.name}":`, err);
              }
            }
          };

          if (event.once) {
            client.once(event.name, wrapperHandler);
          } else {
            client.on(event.name, wrapperHandler);
          }
        } catch (err) {
          if (container.has('errors')) {
            container.resolve('errors').log(err, `plugin_load_event:${file}`);
          } else {
            console.error(`[PluginManager] Failed to load event at ${file}:`, err);
          }
        }
      }
    }

    loadedCount++;
    const duration = Date.now() - startTime;
    if (container.has('metrics')) {
      container.resolve('metrics').trackPluginLoad(config.name, duration);
    }
    console.log(`[PluginManager] Loaded plugin: ${config.name} (v${config.version || '1.0.0'})`);
  }

  console.log(`[PluginManager] Total plugins loaded: ${loadedCount}. Total commands: ${client.commands.size}`);
}

module.exports = { loadPlugins };
