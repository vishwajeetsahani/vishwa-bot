const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ModerationService, ModerationError } = require('../../../utils/moderationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kicks a member from the server.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The member to kick')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('The reason for the kick')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  modOnly: true,

  async execute(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      return interaction.reply({ content: '⚠️ That user is not in this server.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const logEntry = await ModerationService.kick(interaction.guild, interaction.member, targetMember, reason);
      await interaction.editReply(`✅ Successfully kicked **${targetUser.tag}** (Action ID: \`${logEntry.logId}\`).`);
    } catch (err) {
      if (err instanceof ModerationError) {
        await interaction.editReply(err.message);
      } else {
        console.error('[kick cmd] Error:', err);
        await interaction.editReply('❌ An unexpected error occurred while executing that action.');
      }
    }
  }
};
