/**
 * interactionCreate.js
 * -----------------------------------------------------------------------
 * Event handler for when a user runs a slash command.
 * -----------------------------------------------------------------------
 */

const { bypassesAutomod } = require('../utils/permissions');
const container = require('../utils/container');

module.exports = {
  name: 'interactionCreate',
  /**
   * @param {import('discord.js').Interaction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    // Ignore non-chat-input interactions
    if (!interaction.isChatInputCommand()) return;

    // Debug log: Interaction received
    console.log(`[Debug] Interaction received: /${interaction.commandName} (ID: ${interaction.id}) by ${interaction.user.tag}`);

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.warn(`[Debug] Command not found: /${interaction.commandName}`);
      return;
    }

    // Debug log: Command found
    console.log(`[Debug] Command found: ${command.data.name}`);

    try {
      // Enforce moderator-only restriction where applicable
      if (command.modOnly && !bypassesAutomod(interaction.member)) {
        await interaction.reply({
          content: '🚫 You do not have permission to use this command. (Requires Manage Messages or higher.)',
          ephemeral: true
        });
        console.log(`[Debug] Reply sent: Ephemeral permission denied for /${interaction.commandName}`);
        return;
      }

      // Execute command
      const startTime = Date.now();
      await command.execute(interaction, client);
      const duration = Date.now() - startTime;

      if (container.has('metrics')) {
        container.resolve('metrics').trackCommand(interaction.commandName, duration);
      }

      // Debug log: Command executed
      console.log(`[Debug] Command executed: ${command.data.name}`);

      // Debug log: Reply sent
      if (interaction.replied || interaction.deferred) {
        console.log(`[Debug] Reply sent for command: ${command.data.name}`);
      }
    } catch (error) {
      let errorId;
      if (container.has('errors')) {
        errorId = container.resolve('errors').log(error, `command:${interaction.commandName}`);
      } else {
        console.error(`[InteractionCreate] Error executing ${interaction.commandName}:`, error);
      }

      // If interaction is not replied or deferred, send an ephemeral error reply
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `⚠️ There was an error while executing this command!${errorId ? ` (Error ID: ${errorId})` : ''}`,
          ephemeral: true
        });
        console.log(`[Debug] Reply sent: Ephemeral error reply for /${interaction.commandName}`);
      } else {
        await interaction.followUp({
          content: `⚠️ There was an error while executing this command!${errorId ? ` (Error ID: ${errorId})` : ''}`,
          ephemeral: true
        });
        console.log(`[Debug] Reply sent: Ephemeral error followUp for /${interaction.commandName}`);
      }
    }
  }
};
