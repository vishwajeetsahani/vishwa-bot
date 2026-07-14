const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ModerationService, ModerationError } = require('../../../utils/moderationService');
const { parseDuration, formatDuration } = require('../../../utils/duration');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Times out (mutes) a member for a specified duration.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The member to timeout')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('The duration of the timeout (e.g. 10m, 1h, 2d)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('The reason for the timeout')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  modOnly: true,

  async execute(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const durationArg = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      return interaction.reply({ content: '⚠️ That user is not in this server.', ephemeral: true });
    }

    const durationMs = parseDuration(durationArg);
    if (!durationMs) {
      return interaction.reply({
        content: '⚠️ Invalid duration. Use a format like `10s`, `10m`, `1h`, or `2d` (max **28 days**).',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      const logEntry = await ModerationService.timeout(interaction.guild, interaction.member, targetMember, durationMs, reason);
      const formattedDuration = formatDuration(durationMs);
      await interaction.editReply(`✅ Successfully timed out **${targetUser.tag}** for **${formattedDuration}** (Action ID: \`${logEntry.logId}\`).`);
    } catch (err) {
      if (err instanceof ModerationError) {
        await interaction.editReply(err.message);
      } else {
        console.error('[timeout cmd] Error:', err);
        await interaction.editReply('❌ An unexpected error occurred while executing that action.');
      }
    }
  }
};
