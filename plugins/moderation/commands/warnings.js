const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { warnings } = require('../../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription("Lists a member's warning history.")
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to view warnings for')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  modOnly: true,

  async execute(interaction, client) {
    const targetUser = interaction.options.getUser('user');
    const userWarnings = warnings.get(interaction.guild.id, targetUser.id);

    if (userWarnings.length === 0) {
      return interaction.reply({ content: `✅ **${targetUser.tag}** has no warnings.`, ephemeral: true });
    }

    const displayWarnings = userWarnings.slice(-25); // Cap at 25 fields for embed limit

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle(`⚠️ Warnings for ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Total: ${userWarnings.length} warning(s)` })
      .setTimestamp();

    displayWarnings.forEach((warn, index) => {
      const date = new Date(warn.timestamp).toLocaleString();
      embed.addFields({
        name: `#${index + 1} — ${date}`,
        value: `**Reason:** ${warn.reason}\n**Moderator:** <@${warn.moderatorId}>\n**ID:** \`${warn.id}\``
      });
    });

    await interaction.reply({ embeds: [embed] });
  }
};
