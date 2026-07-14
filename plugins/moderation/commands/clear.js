const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ModerationService, ModerationError } = require('../../../utils/moderationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Bulk deletes messages from the channel.')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Number of messages to clear (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  modOnly: true,

  async execute(interaction, client) {
    const amount = interaction.options.getInteger('amount');

    await interaction.deferReply({ ephemeral: true });

    try {
      const { deletedCount, logEntry } = await ModerationService.clear(interaction.channel, interaction.member, amount);
      await interaction.editReply({
        content: `✅ Successfully deleted **${deletedCount}** message(s) (Action ID: \`${logEntry.logId}\`).`
      });
    } catch (err) {
      if (err instanceof ModerationError) {
        await interaction.editReply(err.message);
      } else {
        console.error('[clear cmd] Error:', err);
        await interaction.editReply('❌ An unexpected error occurred while executing that action.');
      }
    }
  }
};
