const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ModerationService, ModerationError } = require('../../../utils/moderationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Removes a timeout from a member.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The member to remove timeout from')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  modOnly: true,

  async execute(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      return interaction.reply({ content: '⚠️ That user is not in this server.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const logEntry = await ModerationService.untimeout(interaction.guild, interaction.member, targetMember, 'Timeout removed');
      await interaction.editReply(`✅ Successfully removed timeout from **${targetUser.tag}** (Action ID: \`${logEntry.logId}\`).`);
    } catch (err) {
      if (err instanceof ModerationError) {
        await interaction.editReply(err.message);
      } else {
        console.error('[untimeout cmd] Error:', err);
        await interaction.editReply('❌ An unexpected error occurred while executing that action.');
      }
    }
  }
};
