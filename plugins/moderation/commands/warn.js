const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ModerationService, ModerationError } = require('../../../utils/moderationService');
const { warnings } = require('../../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issues a warning to a member.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The member to warn')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('The reason for the warning')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
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
      const { warnEntry, logEntry } = await ModerationService.warn(interaction.guild, interaction.member, targetMember, reason);
      const totalWarnings = warnings.count(interaction.guild.id, targetUser.id);
      
      await interaction.editReply(
        `✅ Successfully warned **${targetUser.tag}** (Warning ID: \`${warnEntry.id}\` | Action ID: \`${logEntry.logId}\`).\nTotal Warnings: **${totalWarnings}**`
      );
    } catch (err) {
      if (err instanceof ModerationError) {
        await interaction.editReply(err.message);
      } else {
        console.error('[warn cmd] Error:', err);
        await interaction.editReply('❌ An unexpected error occurred while executing that action.');
      }
    }
  }
};
